/**
 * The karma journal as a synced collection. Sends entries edited at or after the last sync (all live ones on the first
 * sync of an account), merges what the server sends back through the store's own `merge`.
 *
 * At most JOURNAL_SYNC_CHUNK entries go in one request; the rest are held back and the engine sends them in the next
 * requests right away (see `hasMore`), so a large journal is never cut short. Deletion marks are left out of the first
 * sync of an account: that account's server never had those entries, so there is nothing for them to delete there.
 *
 * An entry the server has already seen in this exact version (sent by us, or received from it) is remembered by id
 * and `updatedAt`, so it is not sent again: without that, an entry stamped by another device whose clock runs ahead
 * would look "newer than the last sync" forever and bounce back and forth. Remembering what was sent is also what moves
 * the next chunk along.
 */
import type { JournalEntry } from '@chuanho/contract';
import type { JournalStore } from '../features/journal/journal-store';
import type { SyncedCollection } from './synced-collection';

export const JOURNAL_FULL_CODE = 'journal-full';
/** Entries per request; half the server's per-request limit, so a request stays well inside it. */
export const JOURNAL_SYNC_CHUNK = 1000;

export function createJournalCollection(store: Pick<JournalStore, 'getEntries' | 'merge'>): SyncedCollection {
  const known = new Map<string, number>();
  let heldBack = false;

  const pending = (since: number): JournalEntry[] =>
    store
      .getEntries()
      .filter((entry) => entry.updatedAt >= since && known.get(entry.id) !== entry.updatedAt && (since > 0 || entry.deletedAt === null));

  const remember = (entries: readonly JournalEntry[]): void => {
    for (const entry of entries) known.set(entry.id, entry.updatedAt);
  };

  return {
    key: 'journal',
    fullCode: JOURNAL_FULL_CODE,
    collect(since) {
      const all = pending(since);
      heldBack = all.length > JOURNAL_SYNC_CHUNK;
      return { journal: all.slice(0, JOURNAL_SYNC_CHUNK) };
    },
    hasPending: (since) => pending(since).length > 0,
    hasMore: () => heldBack,
    apply(response, sent) {
      remember(sent.journal);
      // Remembered before merging: the store's change notice then finds nothing new to send.
      remember(response.journal);
      store.merge(response.journal);
    },
    reset() {
      known.clear();
      heldBack = false;
    },
  };
}
