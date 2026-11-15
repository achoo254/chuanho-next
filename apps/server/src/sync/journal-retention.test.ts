import { EMPTY_PROGRESS, type JournalEntry } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { clampEntryTimes, clampProgressTime, journalOverflow } from './journal-retention';

const entry: JournalEntry = {
  id: 'entry-aaa1',
  day: '2026-11-15',
  kind: 'lie',
  note: '',
  released: { reset: false, apology: false, deed: false },
  createdAt: 100,
  updatedAt: 500,
  deletedAt: 900,
};

describe('journal retention', () => {
  it('clamps future times and leaves the rest as they are', () => {
    expect(clampEntryTimes(entry, 1_000)).toBe(entry);
    expect(clampEntryTimes(entry, 400)).toEqual({ ...entry, createdAt: 100, updatedAt: 400, deletedAt: 400 });
    expect(clampEntryTimes({ ...entry, deletedAt: null }, 50)).toEqual({ ...entry, createdAt: 50, updatedAt: 50, deletedAt: null });
    expect(clampProgressTime({ ...EMPTY_PROGRESS, updatedAt: 9_000 }, 5_000).updatedAt).toBe(5_000);
    expect(clampProgressTime(EMPTY_PROGRESS, 5_000)).toBe(EMPTY_PROGRESS);
  });

  it('is full only on live entries; deletion marks over the cap are dropped instead', () => {
    expect(journalOverflow({ live: 10, total: 10 }, 10)).toEqual({ full: false, tombstonesToDrop: 0 });
    expect(journalOverflow({ live: 11, total: 11 }, 10)).toEqual({ full: true, tombstonesToDrop: 0 });
    expect(journalOverflow({ live: 8, total: 13 }, 10)).toEqual({ full: false, tombstonesToDrop: 3 });
  });
});
