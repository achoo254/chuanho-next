/**
 * Clearing the journal on this device for good. The store only knows soft deletion (a deletion mark keeps the note, so
 * the deletion can reach the server), so a wipe merges in blanked deletion marks instead: same ids, no note, nothing
 * released, deleted now. The marks keep nothing personal and are never uploaded: a wipe is always followed by a sync
 * that starts from now. Pure.
 */
import type { JournalEntry } from '@chuanho/contract';

const NOTHING_RELEASED: JournalEntry['released'] = { reset: false, apology: false, deed: false };

export function blankedDeletionMarks(entries: readonly JournalEntry[], now: number): JournalEntry[] {
  return entries.map((entry) => {
    // Never older than the entry itself: the merge keeps the newer version of an id (the incoming one on a tie).
    const stamp = Math.max(now, entry.updatedAt);
    return { ...entry, note: '', released: NOTHING_RELEASED, deletedAt: entry.deletedAt ?? stamp, updatedAt: stamp };
  });
}
