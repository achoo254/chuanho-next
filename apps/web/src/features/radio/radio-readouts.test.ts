import { describe, expect, it } from 'vitest';
import { formatCountdown, radioListenedMinutes, radioTrackNumber } from './radio-readouts';

describe('radio readouts', () => {
  it('numbers the track already playing as 1, then counts the tracks started since', () => {
    const atOpen = { tracksStarted: 4, listenedS: 500 };
    expect(radioTrackNumber(atOpen, atOpen)).toBe(1);
    expect(radioTrackNumber(atOpen, { tracksStarted: 6, listenedS: 900 })).toBe(3);
  });

  it('numbers the first track 1 when nothing was playing yet', () => {
    const atOpen = { tracksStarted: 0, listenedS: 0 };
    expect(radioTrackNumber(atOpen, atOpen)).toBe(1);
    expect(radioTrackNumber(atOpen, { tracksStarted: 1, listenedS: 3 })).toBe(1);
    expect(radioTrackNumber(atOpen, { tracksStarted: 2, listenedS: 200 })).toBe(2);
  });

  it('counts whole minutes heard since the radio opened, never negative', () => {
    expect(radioListenedMinutes({ tracksStarted: 1, listenedS: 100 }, { tracksStarted: 3, listenedS: 100 + 179 })).toBe(2);
    expect(radioListenedMinutes({ tracksStarted: 5, listenedS: 100 }, { tracksStarted: 0, listenedS: 0 })).toBe(0);
  });

  it('formats countdowns as m:ss, rounding up', () => {
    expect(formatCountdown(25 * 60_000)).toBe('25:00');
    expect(formatCountdown(61_001)).toBe('1:02');
    expect(formatCountdown(400)).toBe('0:01');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
    expect(formatCountdown(Number.NaN)).toBe('0:00');
  });
});
