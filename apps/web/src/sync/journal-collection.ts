/**
 * The karma journal as a synced collection. Sends entries edited at or after the last sync (all of them on the first
 * sync of an account), merges what the server sends back through the store's own `merge`.
 *
 * An entry the server has already seen in this exact version (sent by us, or received from it) is remembered by id
 * and `updatedAt`, so it is not sent again: without that, an entry stamped by another device whose clock runs ahead
 * would look "newer than the last sync" forever and bounce back and forth.
 */
import { JOURNAL_MAX_ENTRIES, type JournalEntry } from '@chuanho/contract';
import type { JournalStore } from '../features/journal/journal-store';
import type { SyncedCollection } from './synced-collection';

export const JOURNAL_FULL_CODE = 'journal-full';

export function createJournalCollection(store: Pick<JournalStore, 'getEntries' | 'merge'>): SyncedCollection {
  const known = new Map<string, number>();

  const pending = (since: number): JournalEntry[] =>
    store.getEntries().filter((entry) => entry.updatedAt >= since && known.get(entry.id) !== entry.updatedAt);

  const remember = (entries: readonly JournalEntry[]): void => {
    for (const entry of entries) known.set(entry.id, entry.updatedAt);
  };

  return {
    key: 'journal',
    fullCode: JOURNAL_FULL_CODE,
    collect: (since) => ({ journal: pending(since).slice(0, JOURNAL_MAX_ENTRIES) }),
    hasPending: (since) => pending(since).length > 0,
    apply(response, sent) {
      remember(sent.journal);
      // Remembered before merging: the store's change notice then finds nothing new to send.
      remember(response.journal);
      store.merge(response.journal);
    },
    reset: () => known.clear(),
  };
}
