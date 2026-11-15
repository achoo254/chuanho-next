import { describe, expect, it } from 'vitest';
import { pickTakeIndex, takeUrls, takeVariation } from './sample-takes';

describe('takeUrls', () => {
  it('numbers takes from 01 with the given extension', () => {
    expect(takeUrls('mo', 3, 'wav')).toEqual(['/audio/mo-01.wav', '/audio/mo-02.wav', '/audio/mo-03.wav']);
  });
});

describe('pickTakeIndex', () => {
  it('handles zero or one take', () => {
    expect(pickTakeIndex(0, -1)).toBe(0);
    expect(pickTakeIndex(1, 0)).toBe(0);
  });

  it('never repeats the last take and reaches every other one', () => {
    let last = -1;
    const seen = new Set<number>();
    let seed = 5;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 2000; i += 1) {
      const next = pickTakeIndex(14, last, random);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(14);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBe(14);
  });

  it('stays in range at the edges of the random value', () => {
    expect(pickTakeIndex(4, 3, () => 0.999999)).toBe(2);
    expect(pickTakeIndex(4, 0, () => 0)).toBe(1);
    expect(pickTakeIndex(4, 9, () => 0.999999)).toBe(2);
  });
});

describe('takeVariation', () => {
  it('keeps pitch within 3 % and level within about 1 dB', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const { rate, gain } = takeVariation(() => r);
      expect(rate).toBeGreaterThanOrEqual(0.97);
      expect(rate).toBeLessThanOrEqual(1.03);
      expect(gain).toBeGreaterThanOrEqual(0.89);
      expect(gain).toBeLessThanOrEqual(1.12);
    }
  });
});
