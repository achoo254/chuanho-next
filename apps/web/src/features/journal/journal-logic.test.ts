import { JOURNAL_NOTE_MAX, type JournalEntry, isRecordId, isReleased, liveEntries, mergeJournal, parseJournalEntry } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { cleanNote, completeReleaseStep, createEntry, editNote, newEntryId, pruneDeletionMarks, shortDayLabel, softDelete, softDeleteAll } from './journal-logic';

const T0 = 1_763_200_000_000;
const make = (id: string, now = T0): JournalEntry => createEntry({ kind: 'harsh', note: '  lỡ cáu  ' }, { id, now, day: '2026-11-15' });

describe('createEntry', () => {
  it('makes a live, unreleased entry the contract accepts', () => {
    const entry = make('entry-0001');
    expect(entry).toEqual({
      id: 'entry-0001',
      day: '2026-11-15',
      kind: 'harsh',
      note: 'lỡ cáu',
      released: { reset: false, apology: false, deed: false },
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
    });
    expect(parseJournalEntry(entry)).toEqual(entry);
  });

  it('cuts a note to the contract limit', () => {
    expect(cleanNote('a'.repeat(JOURNAL_NOTE_MAX + 50))).toHaveLength(JOURNAL_NOTE_MAX);
  });
});

describe('newEntryId', () => {
  it('makes ids the contract accepts, all different', () => {
    const ids = Array.from({ length: 50 }, () => newEntryId());
    expect(ids.every(isRecordId)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('editNote', () => {
  it('changes the note and moves updatedAt forward even within the same millisecond', () => {
    const edited = editNote(make('entry-0001'), 'nói lại nhẹ hơn', T0);
    expect(edited.note).toBe('nói lại nhẹ hơn');
    expect(edited.updatedAt).toBe(T0 + 1);
  });

  it('returns the same entry when nothing changes', () => {
    const entry = make('entry-0001');
    expect(editNote(entry, ' lỡ cáu ', T0 + 5)).toBe(entry);
  });
});

describe('completeReleaseStep', () => {
  it('marks steps done one by one until the cloud dissolves', () => {
    let entry = make('entry-0001');
    entry = completeReleaseStep(entry, 'reset', T0 + 10);
    entry = completeReleaseStep(entry, 'deed', T0 + 20);
    expect(isReleased(entry)).toBe(false);
    entry = completeReleaseStep(entry, 'apology', T0 + 30);
    expect(isReleased(entry)).toBe(true);
    expect(entry.updatedAt).toBe(T0 + 30);
  });

  it('does nothing for a step already done', () => {
    const done = completeReleaseStep(make('entry-0001'), 'reset', T0 + 10);
    expect(completeReleaseStep(done, 'reset', T0 + 99)).toBe(done);
  });
});

describe('softDelete', () => {
  it('keeps a deletion mark that wins a merge against the old copy', () => {
    const entry = make('entry-0001');
    const deleted = softDelete(entry, T0 + 100);
    expect(deleted.deletedAt).toBe(T0 + 100);
    expect(deleted.updatedAt).toBe(T0 + 100);
    expect(liveEntries(mergeJournal([entry], [deleted]))).toEqual([]);
    expect(liveEntries(mergeJournal([deleted], [entry]))).toEqual([]);
    expect(softDelete(deleted, T0 + 200)).toBe(deleted);
  });

  it('deletes every live entry and keeps earlier deletions as they were', () => {
    const gone = softDelete(make('entry-0002'), T0 + 5);
    const all = softDeleteAll([make('entry-0001'), gone, make('entry-0003')], T0 + 50);
    expect(liveEntries(all)).toEqual([]);
    expect(all[1]).toBe(gone);
    expect(all.map((entry) => entry.id)).toEqual(['entry-0001', 'entry-0002', 'entry-0003']);
  });
});

describe('shortDayLabel', () => {
  it('shows day/month without leading zeros', () => {
    expect(shortDayLabel('2026-11-05')).toBe('5/11');
    expect(shortDayLabel('2027-01-31')).toBe('31/1');
  });
});

describe('pruneDeletionMarks', () => {
  it('forgets the oldest deletion marks first and never a live entry', () => {
    const live = [make('live-0001'), make('live-0002')];
    const marks = [softDelete(make('mark-0001'), T0 + 30), softDelete(make('mark-0002'), T0 + 10), softDelete(make('mark-0003'), T0 + 20)];
    const kept = pruneDeletionMarks([...live, ...marks], 3).map((entry) => entry.id);
    expect(kept).toEqual(['live-0001', 'live-0002', 'mark-0001']);
    expect(pruneDeletionMarks(live, 1)).toHaveLength(2);
  });
});
