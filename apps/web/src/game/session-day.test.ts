import { describe, expect, it } from 'vitest';
import { isNewFullSessionDay, localDateKey } from './session-day';

describe('localDateKey', () => {
  it('uses the local calendar day, either side of midnight', () => {
    expect(localDateKey(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-15');
    expect(localDateKey(new Date(2026, 10, 16, 0, 1))).toBe('2026-11-16');
    expect(localDateKey(new Date(2027, 0, 1, 8))).toBe('2027-01-01');
  });
});

describe('isNewFullSessionDay', () => {
  it('rewards the first full session ever', () => {
    expect(isNewFullSessionDay(null, '2026-11-15')).toBe(true);
    expect(isNewFullSessionDay(undefined, '2026-11-15')).toBe(true);
  });

  it('rewards only once on the same day', () => {
    expect(isNewFullSessionDay('2026-11-15', '2026-11-15')).toBe(false);
  });

  it('rewards the next day, and after skipped days without penalty', () => {
    expect(isNewFullSessionDay('2026-11-15', '2026-11-16')).toBe(true);
    expect(isNewFullSessionDay('2026-10-01', '2026-11-16')).toBe(true);
    expect(isNewFullSessionDay('2026-12-31', '2027-01-01')).toBe(true);
  });

  it('does not reward when the clock is set back', () => {
    expect(isNewFullSessionDay('2026-11-16', '2026-11-15')).toBe(false);
  });

  it('treats an unreadable stored day as none, and refuses an unreadable today', () => {
    expect(isNewFullSessionDay('garbage', '2026-11-15')).toBe(true);
    expect(isNewFullSessionDay('2026-11-15', 'nope')).toBe(false);
  });

  it('counts a session finished just after local midnight as a new day', () => {
    const lateNight = localDateKey(new Date(2026, 10, 15, 23, 58));
    const afterMidnight = localDateKey(new Date(2026, 10, 16, 0, 2));
    expect(isNewFullSessionDay(lateNight, afterMidnight)).toBe(true);
  });
});
