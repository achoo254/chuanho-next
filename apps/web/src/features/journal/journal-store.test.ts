import { type JournalEntry, liveEntries } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { completeReleaseStep } from './journal-logic';
import { type JournalPersistence, createJournalStore, parseStoredJournal } from './journal-store';

const T0 = 1_763_200_000_000;

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'entry-0001',
  day: '2026-11-15',
  kind: 'lie',
  note: '',
  released: { reset: false, apology: false, deed: false },
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
  ...over,
});

function memoryStore(initial: readonly JournalEntry[] = []): { persistence: JournalPersistence; saved: () => readonly JournalEntry[] } {
  let saved = initial;
  return {
    persistence: {
      load: () => saved,
      save: (entries) => {
        saved = entries;
      },
    },
    saved: () => saved,
  };
}

function testStore(initial: readonly JournalEntry[] = []): { store: ReturnType<typeof createJournalStore>; saved: () => readonly JournalEntry[] } {
  let clock = T0;
  let ids = 0;
  const memory = memoryStore(initial);
  const store = createJournalStore(memory.persistence, {
    now: () => (clock += 1000),
    today: () => '2026-11-15',
    newId: () => `entry-${String((ids += 1)).padStart(4, '0')}`,
  });
  return { store, saved: memory.saved };
}

describe('parseStoredJournal', () => {
  it('starts empty on anything that is not a list', () => {
    for (const raw of [null, 'oops', 42, { entries: [] }]) expect(parseStoredJournal(raw)).toBeNull();
  });

  it('drops bad entries and keeps the good ones', () => {
    expect(parseStoredJournal([entry(), { id: 'X' }, entry({ id: 'entry-0002', kind: 'sad' as never })])).toEqual([entry()]);
  });

  it('keeps one entry per id, the newest', () => {
    expect(parseStoredJournal([entry({ note: 'old' }), entry({ note: 'new', updatedAt: T0 + 5 })])).toEqual([entry({ note: 'new', updatedAt: T0 + 5 })]);
  });
});

describe('createJournalStore', () => {
  it('adds, saves and notifies', () => {
    const { store, saved } = testStore();
    let calls = 0;
    const stop = store.subscribe(() => (calls += 1));
    const added = store.add({ kind: 'gossip', note: ' hơi quá ' });
    expect(added).toMatchObject({ id: 'entry-0001', kind: 'gossip', note: 'hơi quá', day: '2026-11-15' });
    expect(saved()).toEqual([added]);
    expect(calls).toBe(1);
    stop();
    store.add({ kind: 'anger', note: '' });
    expect(calls).toBe(1);
  });

  it('keeps the same list reference until something changes', () => {
    const { store } = testStore([entry()]);
    const before = store.getEntries();
    store.update('missing-id', (e) => e);
    store.update('entry-0001', (e) => e);
    expect(store.getEntries()).toBe(before);
    store.update('entry-0001', (e, now) => completeReleaseStep(e, 'reset', now));
    expect(store.getEntries()).not.toBe(before);
    expect(store.getEntries()[0]?.released.reset).toBe(true);
  });

  it('soft-deletes one or all, keeping the marks for sync', () => {
    const { store, saved } = testStore([entry(), entry({ id: 'entry-0002' }), entry({ id: 'entry-0003' })]);
    store.remove('entry-0002');
    expect(liveEntries(store.getEntries()).map((e) => e.id)).toEqual(['entry-0001', 'entry-0003']);
    store.removeAll();
    expect(liveEntries(store.getEntries())).toEqual([]);
    expect(saved()).toHaveLength(3);
    expect(saved().every((e) => e.deletedAt !== null && e.updatedAt === e.deletedAt)).toBe(true);
  });

  it('merges entries from another device, newest edit winning', () => {
    const { store } = testStore([entry({ note: 'here' })]);
    store.merge([entry({ note: 'there', updatedAt: T0 + 10 }), entry({ id: 'entry-0009', updatedAt: T0 + 3 })]);
    const byId = new Map(store.getEntries().map((e) => [e.id, e]));
    expect(byId.get('entry-0001')?.note).toBe('there');
    expect(byId.has('entry-0009')).toBe(true);
    store.merge([entry({ note: 'stale', updatedAt: T0 - 1 })]);
    expect(store.getEntries().find((e) => e.id === 'entry-0001')?.note).toBe('there');
  });
});
