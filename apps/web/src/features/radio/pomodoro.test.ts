import { describe, expect, it } from 'vitest';
import { CLASSIC_POMODORO, pomodoroStatus } from './pomodoro';

const MIN = 60_000;

describe('pomodoro', () => {
  it('runs 25 minutes of focus, then 5 of rest, then focus again', () => {
    expect(pomodoroStatus(0, 0)).toEqual({ phase: 'focus', remainingMs: 25 * MIN, switches: 0 });
    expect(pomodoroStatus(0, 24 * MIN)).toEqual({ phase: 'focus', remainingMs: MIN, switches: 0 });
    expect(pomodoroStatus(0, 25 * MIN)).toEqual({ phase: 'break', remainingMs: 5 * MIN, switches: 1 });
    expect(pomodoroStatus(0, 30 * MIN)).toEqual({ phase: 'focus', remainingMs: 25 * MIN, switches: 2 });
    expect(pomodoroStatus(0, 57 * MIN)).toEqual({ phase: 'break', remainingMs: 3 * MIN, switches: 3 });
  });

  it('reads the right phase after a long gap (a sleeping phone) and counts every switch it skipped', () => {
    const start = 5_000;
    expect(pomodoroStatus(start, start + 3 * 30 * MIN + 26 * MIN)).toEqual({ phase: 'break', remainingMs: 4 * MIN, switches: 7 });
  });

  it('uses the clock it is given, from any start and with any phase lengths', () => {
    expect(pomodoroStatus(1000, 1000 + 7, { focusMs: 5, breakMs: 3 })).toEqual({ phase: 'break', remainingMs: 1, switches: 1 });
    expect(pomodoroStatus(1000, 0)).toEqual({ phase: 'focus', remainingMs: CLASSIC_POMODORO.focusMs, switches: 0 });
  });

  it('rejects phases that would never end', () => {
    expect(() => pomodoroStatus(0, 1, { focusMs: 0, breakMs: 5 })).toThrow(RangeError);
    expect(() => pomodoroStatus(0, 1, { focusMs: 25, breakMs: Number.NaN })).toThrow(RangeError);
  });
});
