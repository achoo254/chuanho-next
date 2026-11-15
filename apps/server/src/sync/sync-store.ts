/**
 * One sync of an account, in one transaction that first locks the account's row (`lockAccount`): two devices syncing
 * at once take turns, so each account's `server_seq` values commit in the order they were handed out and a cursor never
 * skips a row; a "delete all my data" takes the same lock. Progress merges with the contract's `mergeProgress`; journal
 * edits follow `planJournalWrites`. A request from an older data epoch (a device that missed a wipe) writes nothing.
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
import { and, asc, count, eq, gt, inArray, isNotNull, lt, max, or, sql } from 'drizzle-orm';
import { lockAccount } from '../account/account-lock';
import type { Db, Tx } from '../db/client';
import { journalEntries, progress } from '../db/schema';
import { HttpError } from '../http-error';
import { FUTURE_SKEW_MS, TOMBSTONE_KEEP_MS, clampEntryTimes, clampProgressTime, journalOverflow } from './journal-retention';
import { planJournalWrites } from './journal-write-plan';

/** Live entries an account may keep (deletion marks give way when live plus marks exceed it). */
export const JOURNAL_ROW_CAP = 2 * JOURNAL_MAX_ENTRIES;

type JournalRow = typeof journalEntries.$inferSelect;

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

const ofUser = (userId: string): ReturnType<typeof eq> => eq(journalEntries.userId, userId);

async function storedProgress(tx: Tx, userId: string): Promise<ProgressDoc | null> {
  const [row] = await tx.select({ doc: progress.doc }).from(progress).where(eq(progress.userId, userId));
  return row ? (parseProgressDoc(row.doc) ?? EMPTY_PROGRESS) : null;
}

async function mergeStoredProgress(tx: Tx, userId: string, incoming: ProgressDoc, now: Date): Promise<ProgressDoc> {
  const stored = await storedProgress(tx, userId);
  const merged = stored ? mergeProgress(stored, incoming) : incoming;
  await tx
    .insert(progress)
    .values({ userId, doc: merged, updatedAt: now })
    .onConflictDoUpdate({ target: progress.userId, set: { doc: merged, updatedAt: now } });
  return merged;
}

/** Deletion marks past TOMBSTONE_KEEP_MS (see there for the trade-off). */
async function purgeOldTombstones(tx: Tx, userId: string, nowMs: number): Promise<void> {
  await tx.delete(journalEntries).where(and(ofUser(userId), isNotNull(journalEntries.deletedAt), lt(journalEntries.deletedAt, nowMs - TOMBSTONE_KEEP_MS)));
}

/** Refuses a journal with more live entries than the cap; drops the oldest deletion marks when the rows exceed it. */
async function enforceJournalCap(tx: Tx, userId: string): Promise<void> {
  const [held] = await tx
    .select({ live: sql<number>`count(*) filter (where ${journalEntries.deletedAt} is null)`.mapWith(Number), total: count() })
    .from(journalEntries)
    .where(ofUser(userId));
  const overflow = journalOverflow({ live: held?.live ?? 0, total: held?.total ?? 0 }, JOURNAL_ROW_CAP);
  if (overflow.full) throw new HttpError(409, 'journal-full');
  if (overflow.tombstonesToDrop === 0) return;
  const oldest = tx
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(ofUser(userId), isNotNull(journalEntries.deletedAt)))
    .orderBy(asc(journalEntries.deletedAt))
    .limit(overflow.tombstonesToDrop);
  await tx.delete(journalEntries).where(and(ofUser(userId), inArray(journalEntries.id, oldest)));
}

/** Stores the winning incoming edits; returns the ids whose stored version beat the device's. */
async function writeJournal(tx: Tx, userId: string, incoming: readonly JournalEntry[]): Promise<readonly string[]> {
  if (incoming.length === 0) return [];
  const ids = [...new Set(incoming.map((entry) => entry.id))];
  const stored = await tx
    .select()
    .from(journalEntries)
    .where(and(ofUser(userId), inArray(journalEntries.id, ids)));
  const plan = planJournalWrites(stored.map(toEntry), incoming);
  if (plan.writes.length === 0) return plan.staleIds;
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
  // Checked after the write (the transaction rolls back on refusal), so revivals and deletions count exactly.
  await enforceJournalCap(tx, userId);
  return plan.staleIds;
}

/** Rows after `cursor` (plus the stale ids whatever their seq), oldest change first, and the account's latest seq. */
async function changesSince(tx: Tx, userId: string, cursor: number, staleIds: readonly string[]): Promise<{ journal: JournalEntry[]; cursor: number }> {
  const newer = gt(journalEntries.serverSeq, cursor);
  const changed = await tx
    .select()
    .from(journalEntries)
    .where(and(ofUser(userId), staleIds.length > 0 ? or(newer, inArray(journalEntries.id, [...staleIds])) : newer))
    .orderBy(asc(journalEntries.serverSeq));
  const [high] = await tx.select({ seq: max(journalEntries.serverSeq) }).from(journalEntries).where(ofUser(userId));
  return { journal: changed.map(toEntry), cursor: Number(high?.seq ?? 0) };
}

export async function syncAccount(db: Db, userId: string, request: SyncRequest, now: Date): Promise<SyncResponse> {
  return db.transaction(async (tx) => {
    const epoch = await lockAccount(tx, userId);
    if (request.epoch !== 0 && request.epoch !== epoch) {
      // A device from before a wipe: none of its payload is written; it gets the account as it is now, from scratch.
      const current = await changesSince(tx, userId, 0, []);
      return { progress: (await storedProgress(tx, userId)) ?? EMPTY_PROGRESS, ...current, epoch };
    }
    const nowMs = now.getTime();
    const latest = nowMs + FUTURE_SKEW_MS;
    await purgeOldTombstones(tx, userId, nowMs);
    const merged = await mergeStoredProgress(tx, userId, clampProgressTime(request.progress, latest), now);
    const staleIds = await writeJournal(
      tx,
      userId,
      request.journal.map((entry) => clampEntryTimes(entry, latest)),
    );
    return { progress: merged, ...(await changesSince(tx, userId, request.cursor, staleIds)), epoch };
  });
}
