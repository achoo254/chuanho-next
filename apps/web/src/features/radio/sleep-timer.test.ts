import { describe, expect, it } from 'vitest';
import { MAX_SLEEP_FADE_MS, sleepFadeLevel, sleepFadeMs, sleepTimerStatus, startSleepTimer } from './sleep-timer';

const MIN = 60_000;

describe('sleep timer', () => {
  it('counts down and ends exactly at its length', () => {
    const timer = startSleepTimer(1000, 30);
    expect(sleepTimerStatus(timer, 1000)).toEqual({ remainingMs: 30 * MIN, fadeProgress: 0, done: false });
    expect(sleepTimerStatus(timer, 1000 + 10 * MIN).remainingMs).toBe(20 * MIN);
    expect(sleepTimerStatus(timer, 1000 + 30 * MIN)).toEqual({ remainingMs: 0, fadeProgress: 1, done: true });
    expect(sleepTimerStatus(timer, 1000 + 90 * MIN).done).toBe(true);
  });

  it('fades over the last five minutes of long timers and the last third of short ones', () => {
    expect(sleepFadeMs(60 * MIN)).toBe(MAX_SLEEP_FADE_MS);
    expect(sleepFadeMs(9 * MIN)).toBe(3 * MIN);
    const timer = startSleepTimer(0, 30);
    expect(sleepTimerStatus(timer, 25 * MIN - 1).fadeProgress).toBe(0);
    expect(sleepTimerStatus(timer, 27.5 * MIN).fadeProgress).toBeCloseTo(0.5);
  });

  it('never ends "until I stop", and treats nonsense minutes the same way', () => {
    for (const minutes of [null, 0, -5, Number.NaN, Infinity]) {
      const timer = startSleepTimer(0, minutes);
      expect(timer.durationMs).toBeNull();
      expect(sleepTimerStatus(timer, 10 * 60 * MIN)).toEqual({ remainingMs: null, fadeProgress: 0, done: false });
    }
  });

  it('treats a clock that went backwards as no time passed', () => {
    const timer = startSleepTimer(10 * MIN, 15);
    expect(sleepTimerStatus(timer, 0)).toEqual({ remainingMs: 15 * MIN, fadeProgress: 0, done: false });
  });
});

describe('fade level', () => {
  it('falls from full to silent and clamps bad input', () => {
    expect(sleepFadeLevel(0)).toBe(1);
    expect(sleepFadeLevel(1)).toBe(0);
    expect(sleepFadeLevel(0.5)).toBeCloseTo(0.25);
    expect(sleepFadeLevel(-1)).toBe(1);
    expect(sleepFadeLevel(2)).toBe(0);
    expect(sleepFadeLevel(Number.NaN)).toBe(1);
    for (let step = 0; step < 10; step += 1) expect(sleepFadeLevel((step + 1) / 10)).toBeLessThan(sleepFadeLevel(step / 10));
  });
});
