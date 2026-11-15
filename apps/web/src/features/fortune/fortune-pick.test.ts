import { describe, expect, it } from 'vitest';
import { dayNumber, drawFortune, drewToday, parseFortuneState, queIndex } from './fortune-pick';
import { isShakeMotion } from './fortune-shake';

const SEED = 'a1b2c3d4-0000-4000-8000-123456789abc';

/** `count` consecutive days from 2026-01-01 as `YYYY-MM-DD`. */
function days(count: number): string[] {
  const start = Date.UTC(2026, 0, 1);
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

describe('queIndex', () => {
  it('is the same all day for a device and stays inside the deck', () => {
    expect(queIndex(SEED, '2026-11-15', 64)).toBe(queIndex(SEED, '2026-11-15', 64));
    for (const day of days(200)) {
      const index = queIndex(SEED, day, 64);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(64);
    }
  });

  it('never gives the same quẻ two days in a row, also across blocks', () => {
    for (const seed of [SEED, 'other-device-seed', 'x1y2']) {
      const picks = days(400).map((day) => queIndex(seed, day, 64));
      for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
    }
  });

  it('shows every quẻ once per block of deck-size days', () => {
    const block = Math.floor(dayNumber('2026-11-15') / 8) * 8;
    const start = Date.UTC(1970, 0, 1) + block * 86_400_000;
    const blockDays = Array.from({ length: 8 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
    expect(new Set(blockDays.map((day) => queIndex(SEED, day, 8))).size).toBe(8);
  });

  it('differs between devices and refuses bad input', () => {
    const a = days(30).map((day) => queIndex(SEED, day, 64));
    const b = days(30).map((day) => queIndex('another-seed', day, 64));
    expect(a).not.toEqual(b);
    expect(() => queIndex(SEED, '15/11/2026', 64)).toThrow(RangeError);
    expect(() => queIndex(SEED, '2026-11-15', 1)).toThrow(RangeError);
  });
});

describe('parseFortuneState', () => {
  it('keeps a valid state and forgets a broken last draw', () => {
    expect(parseFortuneState({ seed: SEED, lastDay: '2026-11-15', lastIndex: 3 })).toEqual({ seed: SEED, lastDay: '2026-11-15', lastIndex: 3 });
    expect(parseFortuneState({ seed: SEED, lastDay: 'yesterday', lastIndex: 3 })).toEqual({ seed: SEED, lastDay: null, lastIndex: null });
    expect(parseFortuneState({ seed: SEED, lastDay: '2026-11-15', lastIndex: -1 })).toEqual({ seed: SEED, lastDay: null, lastIndex: null });
  });

  it('refuses a missing or odd seed', () => {
    expect(parseFortuneState(null)).toBeNull();
    expect(parseFortuneState({ seed: '' })).toBeNull();
    expect(parseFortuneState({ seed: 'has spaces <b>' })).toBeNull();
  });
});

describe('drawFortune', () => {
  const newSeed = (): string => SEED;

  it('makes a seed on the first draw and remembers the day', () => {
    const draw = drawFortune(null, '2026-11-15', 64, newSeed);
    expect(draw.again).toBe(false);
    expect(draw.state).toEqual({ seed: SEED, lastDay: '2026-11-15', lastIndex: draw.index });
    expect(draw.index).toBe(queIndex(SEED, '2026-11-15', 64));
  });

  it('shows the same quẻ again the same day, and a new one the next day', () => {
    const first = drawFortune(null, '2026-11-15', 64, newSeed);
    const again = drawFortune(first.state, '2026-11-15', 64, () => 'never-used');
    expect(again).toEqual({ index: first.index, again: true, state: first.state });
    const tomorrow = drawFortune(first.state, '2026-11-16', 64, () => 'never-used');
    expect(tomorrow.again).toBe(false);
    expect(tomorrow.state.seed).toBe(SEED);
    expect(tomorrow.index).not.toBe(first.index);
  });

  it('draws anew when the deck shrank under the saved index', () => {
    const state = { seed: SEED, lastDay: '2026-11-15', lastIndex: 60 };
    expect(drewToday(state, '2026-11-15', 64)).toBe(true);
    expect(drewToday(state, '2026-11-15', 10)).toBe(false);
    expect(drawFortune(state, '2026-11-15', 10, newSeed).again).toBe(false);
  });
});

describe('isShakeMotion', () => {
  it('counts a firm shake and ignores stillness or missing axes', () => {
    expect(isShakeMotion(14, 8, 2)).toBe(true);
    expect(isShakeMotion(1, 2, 0.5)).toBe(false);
    expect(isShakeMotion(null, null, null)).toBe(false);
  });
});
