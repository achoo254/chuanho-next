/**
 * The karma journal on this device: a tiny external store (read with `useJournal()`), saved to localStorage under
 * `chuanho.journal.v1` as the full list of entries, deletion marks included. Unreadable storage starts empty; an
 * entry that fails the contract's check is dropped without losing the others.
 *
 * Sync seam: account sync calls `journalStore.merge(entriesFromServer)`, which merges by id with `mergeJournal`
 * (newer `updatedAt` wins, deletions included), saves and notifies the screen. To upload, it reads `getEntries()`
 * and sends those with `updatedAt` after its own last-sync time; the deletion marks are kept for exactly that. This
 * file never talks to the network.
 */
import { JOURNAL_MAX_ENTRIES, type JournalEntry, mergeJournal, parseJournalEntry } from '@chuanho/contract';
import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../../game/safe-storage';
import { localDateKey } from '../../game/session-day';
import { type NewEntryInput, createEntry, newEntryId, pruneDeletionMarks, softDelete, softDeleteAll } from './journal-logic';

export const JOURNAL_STORAGE_KEY = 'chuanho.journal.v1';

/** Stored JSON to entries: not a list → null (start empty); bad entries dropped; one entry per id (the newest). */
export function parseStoredJournal(raw: unknown): JournalEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = raw.map(parseJournalEntry).filter((entry): entry is JournalEntry => entry !== null);
  return mergeJournal([], valid);
}

/** Where the list lives; localStorage in the app, a plain object in tests. */
export interface JournalPersistence {
  load(): readonly JournalEntry[];
  save(entries: readonly JournalEntry[]): void;
}

/** The clock, the local day and new ids, injectable so the store is testable without a browser. */
export interface JournalEnvironment {
  now(): number;
  today(): string;
  newId(): string;
}

export interface JournalStore {
  /** Every entry, deletion marks included (same array until something changes). Show `liveEntries()` of it. */
  getEntries(): readonly JournalEntry[];
  subscribe(listener: () => void): () => void;
  add(input: NewEntryInput): JournalEntry;
  /** Applies a pure change (from journal-logic) to one entry; unknown ids and no-op changes are ignored. */
  update(id: string, change: (entry: JournalEntry, now: number) => JournalEntry): void;
  remove(id: string): void;
  removeAll(): void;
  /** Merges entries from elsewhere (account sync). See the header. */
  merge(incoming: readonly JournalEntry[]): void;
}

export function createJournalStore(persistence: JournalPersistence, env: JournalEnvironment): JournalStore {
  let entries: readonly JournalEntry[] | null = null;
  const listeners = new Set<() => void>();

  // Loaded on first use, so importing the module touches no storage.
  const current = (): readonly JournalEntry[] => {
    entries ??= persistence.load();
    return entries;
  };

  const commit = (next: readonly JournalEntry[]): void => {
    entries = pruneDeletionMarks(next, JOURNAL_MAX_ENTRIES);
    persistence.save(entries);
    for (const listener of listeners) listener();
  };

  const update: JournalStore['update'] = (id, change) => {
    const list = current();
    const index = list.findIndex((entry) => entry.id === id);
    const before = list[index];
    if (!before) return;
    const after = change(before, env.now());
    if (after !== before) commit(list.map((entry, i) => (i === index ? after : entry)));
  };

  // Plain closures (no `this`), so `useSyncExternalStore(store.subscribe, store.getEntries)` works unbound.
  return {
    getEntries: current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    add(input) {
      const entry = createEntry(input, { id: env.newId(), now: env.now(), day: env.today() });
      commit([...current(), entry]);
      return entry;
    },
    update,
    remove: (id) => update(id, softDelete),
    removeAll() {
      const list = current();
      const next = softDeleteAll(list, env.now());
      if (next.some((entry, i) => entry !== list[i])) commit(next);
    },
    merge(incoming) {
      if (incoming.length > 0) commit(mergeJournal(current(), incoming));
    },
  };
}

const localStoragePersistence: JournalPersistence = {
  load: () => readStored(JOURNAL_STORAGE_KEY, parseStoredJournal) ?? [],
  save: (entries) => {
    writeStored(JOURNAL_STORAGE_KEY, entries);
  },
};

/** The app's one journal. */
export const journalStore: JournalStore = createJournalStore(localStoragePersistence, {
  now: () => Date.now(),
  today: () => localDateKey(new Date()),
  newId: () => newEntryId(),
});

/** Every entry (deletion marks included), re-rendering when the journal changes. */
export function useJournal(store: JournalStore = journalStore): readonly JournalEntry[] {
  return useSyncExternalStore(store.subscribe, store.getEntries, store.getEntries);
}
