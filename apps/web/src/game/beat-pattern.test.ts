import { describe, expect, it } from 'vitest';
import { BEATS_PER_BAR, COUNT_IN_BARS, DIFFICULTIES, DIFFICULTY_SPECS, OUTRO_BARS, generateBeatChart } from './beat-pattern';
import { GOOD_WINDOW_MS } from './grade-tap';

describe('generateBeatChart', () => {
  it('lasts about a minute at every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const chart = generateBeatChart(difficulty);
      expect(chart.durationMs).toBeGreaterThan(55_000);
      expect(chart.durationMs).toBeLessThan(65_000);
    }
  });

  it('gives harder songs more notes', () => {
    const counts = DIFFICULTIES.map((difficulty) => generateBeatChart(difficulty).notes.length);
    const [easy, normal, hard] = counts as [number, number, number];
    expect(easy).toBeGreaterThanOrEqual(20);
    expect(normal).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(normal);
  });

  it('keeps every note on the beat grid, ascending, inside the playable bars', () => {
    for (const difficulty of DIFFICULTIES) {
      const chart = generateBeatChart(difficulty);
      const first = COUNT_IN_BARS * BEATS_PER_BAR * chart.beatMs;
      const end = chart.durationMs - OUTRO_BARS * BEATS_PER_BAR * chart.beatMs;
      chart.notes.forEach((time, index) => {
        expect(time).toBeGreaterThanOrEqual(first);
        expect(time).toBeLessThan(end);
        const halfBeats = time / (chart.beatMs / 2);
        expect(Math.abs(halfBeats - Math.round(halfBeats))).toBeLessThan(1e-6);
        if (index > 0) expect(time).toBeGreaterThan(chart.notes[index - 1] ?? Number.NEGATIVE_INFINITY);
      });
    }
  });

  it('respects the minimum gap, wide enough that two notes never share a GOOD window', () => {
    for (const difficulty of DIFFICULTIES) {
      const chart = generateBeatChart(difficulty);
      const minGap = DIFFICULTY_SPECS[difficulty].minGapBeats * chart.beatMs;
      expect(minGap).toBeGreaterThan(2 * GOOD_WINDOW_MS);
      for (let i = 1; i < chart.notes.length; i += 1) {
        const gap = (chart.notes[i] ?? 0) - (chart.notes[i - 1] ?? 0);
        expect(gap).toBeGreaterThanOrEqual(minGap - 1e-6);
      }
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    expect(generateBeatChart('normal', 3)).toEqual(generateBeatChart('normal', 3));
    expect(generateBeatChart('hard', 1).notes).not.toEqual(generateBeatChart('hard', 2).notes);
  });
});
