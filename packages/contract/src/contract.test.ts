import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRESS,
  type JournalEntry,
  checkWish,
  countByDay,
  isQuietHourNow,
  isRoomCode,
  mergeJournal,
  mergeProgress,
  msUntilQuietHour,
  parseJournalEntry,
  parseQuietHourBeatsInput,
  parseRoomCreateInput,
  parseSyncRequest,
  quietHourWindow,
  roomStatus,
  stickState,
  vietnamDay,
} from './index';

const entry = (over: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'entry-0001',
  day: '2026-11-10',
  kind: 'anger',
  note: '',
  released: { reset: false, apology: false, deed: false },
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
  ...over,
});

describe('journal', () => {
  it('parses a valid entry and rejects a bad kind, id or day', () => {
    expect(parseJournalEntry(entry())).toEqual(entry());
    expect(parseJournalEntry({ ...entry(), kind: 'sad' })).toBeNull();
    expect(parseJournalEntry({ ...entry(), id: 'X' })).toBeNull();
    expect(parseJournalEntry({ ...entry(), day: '2026-02-31' })).toBeNull();
  });

  it('merges by id with the newest edit winning, deletions included', () => {
    const merged = mergeJournal([entry({ note: 'old' })], [entry({ note: 'new', updatedAt: 2000 }), entry({ id: 'entry-0002', updatedAt: 1500 })]);
    expect(merged.find((e) => e.id === 'entry-0001')?.note).toBe('new');
    expect(merged).toHaveLength(2);
    const deleted = mergeJournal([entry({ updatedAt: 3000, deletedAt: 3000 })], [entry({ updatedAt: 2000 })]);
    expect(deleted[0]?.deletedAt).toBe(3000);
  });

  it('counts live entries per day for the weekly chart', () => {
    const days = countByDay([entry({ day: '2026-11-10' }), entry({ id: 'entry-0002', day: '2026-11-10' }), entry({ id: 'entry-0003', day: '2026-11-09', deletedAt: 5 })], '2026-11-10', 3);
    expect(days).toEqual([
      { day: '2026-11-08', count: 0 },
      { day: '2026-11-09', count: 0 },
      { day: '2026-11-10', count: 2 },
    ]);
  });
});

describe('progress merge', () => {
  it('takes the larger counters and the newer preferences', () => {
    const a = { ...EMPTY_PROGRESS, merit: 30, bestCombo: 5, moSkin: 'carved' as const, updatedAt: 10 };
    const b = { ...EMPTY_PROGRESS, merit: 20, bestCombo: 9, lastRewardedDay: '2026-11-10', moSkin: 'fish' as const, updatedAt: 20 };
    expect(mergeProgress(a, b)).toMatchObject({ merit: 30, bestCombo: 9, lastRewardedDay: '2026-11-10', moSkin: 'fish', updatedAt: 20 });
  });
});

describe('sync request', () => {
  it('accepts a well-formed request and rejects one with a bad entry', () => {
    expect(parseSyncRequest({ progress: EMPTY_PROGRESS, journal: [entry()], cursor: 0 })?.journal).toHaveLength(1);
    expect(parseSyncRequest({ progress: EMPTY_PROGRESS, journal: [{ id: 1 }], cursor: 0 })).toBeNull();
    expect(parseSyncRequest({ progress: EMPTY_PROGRESS, journal: [], cursor: -1 })).toBeNull();
  });
});

describe('checkWish', () => {
  it('lets a plain wish through, trimmed', () => {
    expect(checkWish('  Mong deadline nhẹ như mây  ')).toEqual({ ok: true, text: 'Mong deadline nhẹ như mây' });
  });

  it('blocks phone numbers, links, emails, money and OTP asks, even disguised', () => {
    expect(checkWish('gọi 0912 345 678 nha')).toEqual({ ok: false, reason: 'phone' });
    expect(checkWish('0912.345.678')).toEqual({ ok: false, reason: 'phone' });
    expect(checkWish('vào http://abc.vn đi')).toEqual({ ok: false, reason: 'link' });
    expect(checkWish('xem abc.com nè')).toEqual({ ok: false, reason: 'link' });
    expect(checkWish('mail me@x.co')).toEqual({ ok: false, reason: 'email' });
    expect(checkWish('chuyển khoản giúp mình')).toEqual({ ok: false, reason: 'money' });
    expect(checkWish('gửi mã OTP cho mình')).toEqual({ ok: false, reason: 'money' });
    expect(checkWish('chuyen-khoan nhe')).toEqual({ ok: false, reason: 'money' });
  });

  it('blocks rude words as whole words only, and over-long or empty text', () => {
    expect(checkWish('đm sếp')).toEqual({ ok: false, reason: 'rude' });
    expect(checkWish('admin ơi cho nghỉ sớm')).toEqual({ ok: true, text: 'admin ơi cho nghỉ sớm' });
    expect(checkWish('')).toEqual({ ok: false, reason: 'empty' });
    expect(checkWish('a'.repeat(81))).toEqual({ ok: false, reason: 'tooLong' });
  });
});

describe('rooms', () => {
  it('validates codes and create input', () => {
    expect(isRoomCode('ABC234')).toBe(true);
    expect(isRoomCode('ABC0I1')).toBe(false);
    expect(parseRoomCreateInput({ name: ' Phòng PTPM ', theme: 'deadline' })).toEqual({ name: 'Phòng PTPM', theme: 'deadline', burnMinutes: 60 });
    expect(parseRoomCreateInput({ name: 'x', theme: 'deadline', burnMinutes: 45 })).toBeNull();
  });

  it('tracks a stick burning down and the room turning to ashes', () => {
    const stick = { litAt: 0, burnsOutAt: 60 * 60_000 };
    expect(stickState(stick, 30 * 60_000)).toEqual({ progress: 0.5, minutesLeft: 30, burntOut: false });
    expect(stickState(stick, 61 * 60_000).burntOut).toBe(true);
    expect(roomStatus([{ stick: null }], 1e12)).toBe('open');
    expect(roomStatus([{ stick }, { stick: null }], 61 * 60_000)).toBe('ashes');
    expect(roomStatus([{ stick }], 10)).toBe('open');
  });
});

describe('quiet hour', () => {
  it('runs 22:30 to 23:00 Vietnam time', () => {
    const { start, end } = quietHourWindow('2026-11-15');
    expect(new Date(start).toISOString()).toBe('2026-11-15T15:30:00.000Z');
    expect(end - start).toBe(30 * 60_000);
    expect(isQuietHourNow(start)).toBe(true);
    expect(isQuietHourNow(end)).toBe(false);
    expect(vietnamDay(start)).toBe('2026-11-15');
  });

  it('counts down to the next start, also after tonight is over', () => {
    const { start, end } = quietHourWindow('2026-11-15');
    expect(msUntilQuietHour(start - 1000)).toBe(1000);
    expect(msUntilQuietHour(start + 1000)).toBe(0);
    expect(msUntilQuietHour(end)).toBe(quietHourWindow('2026-11-16').start - end);
  });

  it('validates a beat batch', () => {
    expect(parseQuietHourBeatsInput({ day: '2026-11-15', count: 12 })).toEqual({ day: '2026-11-15', count: 12 });
    expect(parseQuietHourBeatsInput({ day: '2026-11-15', count: 0 })).toBeNull();
    expect(parseQuietHourBeatsInput({ day: '2026-11-15', count: 500 })).toBeNull();
  });
});
