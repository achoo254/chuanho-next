/**
 * One sync of an account, in one transaction that first locks the account's row: two devices syncing at once take
 * turns, so each account's `server_seq` values commit in the order they were handed out and a cursor never skips a
 * row. Progress merges with the contract's `mergeProgress`; journal edits follow `planJournalWrites`.
 */
import {
  EMPTY_PROGRESS,
  JOURNAL_MAX_ENTRIES,
  type JournalEntry,
  type ProgressDoc,
  type SyncRequest,
  type SyncResponse,
  mergeProgress,
  parseProgressDoc,
} from '@chuanho/contract';
import { and, asc, count, eq, gt, inArray, max, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { journalEntries, progress, users } from '../db/schema';
import { HttpError } from '../http-error';
import { planJournalWrites } from './journal-write-plan';

/** Rows an account may keep, deletions included (they stay so the deletion reaches every device). */
export const JOURNAL_ROW_CAP = 2 * JOURNAL_MAX_ENTRIES;

type JournalRow = typeof journalEntries.$inferSelect;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const toEntry = (row: JournalRow): JournalEntry => ({
  id: row.id,
  day: row.day,
  kind: row.kind,
  note: row.note,
  released: { reset: row.releasedReset, apology: row.releasedApology, deed: row.releasedDeed },
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt,
});

const toRow = (userId: string, entry: JournalEntry): Omit<JournalRow, 'serverSeq'> => ({
  userId,
  id: entry.id,
  day: entry.day,
  kind: entry.kind,
  note: entry.note,
  releasedReset: entry.released.reset,
  releasedApology: entry.released.apology,
  releasedDeed: entry.released.deed,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  deletedAt: entry.deletedAt,
});

async function mergeStoredProgress(tx: Tx, userId: string, incoming: ProgressDoc, now: Date): Promise<ProgressDoc> {
  const [row] = await tx.select({ doc: progress.doc }).from(progress).where(eq(progress.userId, userId));
  const merged = row ? mergeProgress(parseProgressDoc(row.doc) ?? EMPTY_PROGRESS, incoming) : incoming;
  await tx
    .insert(progress)
    .values({ userId, doc: merged, updatedAt: now })
    .onConflictDoUpdate({ target: progress.userId, set: { doc: merged, updatedAt: now } });
  return merged;
}

/** Stores the winning incoming edits; returns the ids whose stored version beat the device's. */
async function writeJournal(tx: Tx, userId: string, incoming: readonly JournalEntry[]): Promise<readonly string[]> {
  if (incoming.length === 0) return [];
  const ids = [...new Set(incoming.map((entry) => entry.id))];
  const stored = await tx
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, userId), inArray(journalEntries.id, ids)));
  const plan = planJournalWrites(stored.map(toEntry), incoming);
  if (plan.newCount > 0) {
    const [held] = await tx.select({ rows: count() }).from(journalEntries).where(eq(journalEntries.userId, userId));
    if ((held?.rows ?? 0) + plan.newCount > JOURNAL_ROW_CAP) throw new HttpError(409, 'journal-full');
  }
  if (plan.writes.length > 0) {
    const excluded = (column: string): ReturnType<typeof sql.raw> => sql.raw(`excluded.${column}`);
    await tx
      .insert(journalEntries)
      .values(plan.writes.map((entry) => toRow(userId, entry)))
      .onConflictDoUpdate({
        target: [journalEntries.userId, journalEntries.id],
        set: {
          day: excluded('day'),
          kind: excluded('kind'),
          note: excluded('note'),
          releasedReset: excluded('released_reset'),
          releasedApology: excluded('released_apology'),
          releasedDeed: excluded('released_deed'),
          createdAt: excluded('created_at'),
          updatedAt: excluded('updated_at'),
          deletedAt: excluded('deleted_at'),
          // A changed row moves past every cursor handed out so far.
          serverSeq: sql`nextval('journal_server_seq')`,
        },
      });
  }
  return plan.staleIds;
}

export async function syncAccount(db: Db, userId: string, request: SyncRequest, now: Date): Promise<SyncResponse> {
  return db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const merged = await mergeStoredProgress(tx, userId, request.progress, now);
    const staleIds = await writeJournal(tx, userId, request.journal);

    const newer = gt(journalEntries.serverSeq, request.cursor);
    const changed = await tx
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, userId), staleIds.length > 0 ? or(newer, inArray(journalEntries.id, [...staleIds])) : newer))
      .orderBy(asc(journalEntries.serverSeq));
    const [high] = await tx.select({ seq: max(journalEntries.serverSeq) }).from(journalEntries).where(eq(journalEntries.userId, userId));
    return { progress: merged, journal: changed.map(toEntry), cursor: Number(high?.seq ?? 0) };
  });
}
