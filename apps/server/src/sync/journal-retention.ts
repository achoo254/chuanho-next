/**
 * What the server keeps of an account's journal, and how far into the future a device clock may write. Pure, no
 * database; sync-store applies these inside the sync transaction.
 */
import type { JournalEntry, ProgressDoc } from '@chuanho/contract';

const DAY_MS = 86_400_000;

/**
 * A deletion mark is kept this long, then purged. By then it has reached every device that synced in those 90 days.
 * The trade-off: a device that stays offline longer never learns of that deletion and keeps the entry locally (it is
 * not sent back unless edited there, because a device only uploads its own edits since its last sync).
 */
export const TOMBSTONE_KEEP_MS = 90 * DAY_MS;

/** How far ahead of the server clock a device time may be: further is clamped, so a wrong clock cannot win forever. */
export const FUTURE_SKEW_MS = DAY_MS;

/** Times past `latest` are pulled back to it (never rejected: the entry itself is fine, only the clock is off). */
export function clampEntryTimes(entry: JournalEntry, latest: number): JournalEntry {
  const createdAt = Math.min(entry.createdAt, latest);
  const updatedAt = Math.min(entry.updatedAt, latest);
  const deletedAt = entry.deletedAt === null ? null : Math.min(entry.deletedAt, latest);
  return createdAt === entry.createdAt && updatedAt === entry.updatedAt && deletedAt === entry.deletedAt ? entry : { ...entry, createdAt, updatedAt, deletedAt };
}

export const clampProgressTime = (doc: ProgressDoc, latest: number): ProgressDoc => (doc.updatedAt > latest ? { ...doc, updatedAt: latest } : doc);

export interface JournalOverflow {
  /** More live entries than the cap: the sync is refused (`journal-full`). */
  readonly full: boolean;
  /** Oldest deletion marks to drop so live plus marks stay under the cap. */
  readonly tombstonesToDrop: number;
}

/** Only live entries can fill the journal; deletion marks give way (oldest first) when the rows exceed the cap. */
export function journalOverflow(held: { readonly live: number; readonly total: number }, cap: number): JournalOverflow {
  if (held.live > cap) return { full: true, tombstonesToDrop: 0 };
  return { full: false, tombstonesToDrop: Math.max(0, held.total - cap) };
}
