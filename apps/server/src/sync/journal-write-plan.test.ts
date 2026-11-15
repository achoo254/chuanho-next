import type { JournalEntry } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { forStorage, planJournalWrites } from './journal-write-plan';

const entry = (id: string, updatedAt: number, change: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  day: '2026-11-15',
  kind: 'harsh',
  note: `note of ${id}`,
  released: { reset: false, apology: false, deed: false },
  createdAt: 1_000,
  updatedAt,
  deletedAt: null,
  ...change,
});

describe('journal write plan', () => {
  it('stores new ids and newer edits, and counts the new ids', () => {
    const stored = [entry('entry-aaa1', 100)];
    const plan = planJournalWrites(stored, [entry('entry-aaa1', 200), entry('entry-bbb2', 50)]);
    expect(plan.writes.map((e) => [e.id, e.updatedAt])).toEqual([
      ['entry-aaa1', 200],
      ['entry-bbb2', 50],
    ]);
    expect(plan.newCount).toBe(1);
    expect(plan.staleIds).toEqual([]);
  });

  it('keeps the stored version against an older edit and sends it back', () => {
    const stored = [entry('entry-aaa1', 300, { note: 'newer' })];
    const plan = planJournalWrites(stored, [entry('entry-aaa1', 200, { note: 'older' })]);
    expect(plan.writes).toEqual([]);
    expect(plan.staleIds).toEqual(['entry-aaa1']);
  });

  it('lets the incoming edit win a tie, as the contract merge does', () => {
    const plan = planJournalWrites([entry('entry-aaa1', 300, { note: 'server' })], [entry('entry-aaa1', 300, { note: 'device' })]);
    expect(plan.writes.map((e) => e.note)).toEqual(['device']);
    expect(plan.staleIds).toEqual([]);
  });

  it('keeps the newest of the same id sent twice in one call', () => {
    const plan = planJournalWrites([], [entry('entry-aaa1', 300, { note: 'late' }), entry('entry-aaa1', 100, { note: 'early' })]);
    expect(plan.writes.map((e) => e.note)).toEqual(['late']);
    expect(plan.newCount).toBe(1);
  });

  it('empties the note of a deletion', () => {
    const plan = planJournalWrites([entry('entry-aaa1', 100)], [entry('entry-aaa1', 200, { deletedAt: 200 })]);
    expect(plan.writes).toEqual([{ ...entry('entry-aaa1', 200, { deletedAt: 200 }), note: '' }]);
    expect(forStorage(entry('entry-ccc3', 1))).toEqual(entry('entry-ccc3', 1));
  });
});
