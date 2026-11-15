import { describe, expect, it } from 'vitest';
import { RECENT_TRACKS, SONG_CAP_MS, SONG_FADE_MS, buildLibraryChart, parseRecentTracks, pickLibraryTrack, rememberPlayed } from './beat-library-song';
import { BEATS_PER_BAR } from './beat-pattern';

/** A beatmap at `bpm` whose first downbeat is at `offsetMs`: easy every 2nd beat, normal every beat, hard every half. */
function beatmap(bpm: number, offsetMs: number, durationMs: number): Parameters<typeof buildLibraryChart>[0] {
  const beatMs = 60_000 / bpm;
  const beats: number[] = [];
  for (let t = offsetMs; t < durationMs - 3000; t += beatMs) beats.push(Math.round(t));
  const halves = beats.flatMap((t) => [t, Math.round(t + beatMs / 2)]);
  return { bpm, offsetMs, levels: { easy: beats.filter((_, i) => i % 2 === 0), normal: beats, hard: halves } };
}

describe('buildLibraryChart', () => {
  it('puts song time 0 on a downbeat and keeps the notes on the beat grid', () => {
    const map = beatmap(60, 5300, 120_000);
    const chart = buildLibraryChart(map, 'normal', 120_000);
    expect(chart).not.toBeNull();
    if (!chart) return;
    const barMs = BEATS_PER_BAR * chart.beatMs;
    expect(chart.audioOriginMs).toBeCloseTo(5300 % barMs, 6);
    expect(chart.audioOriginMs).toBeLessThan(barMs);
    for (const note of chart.notes) {
      const beats = note / chart.beatMs;
      expect(Math.abs(beats - Math.round(beats))).toBeLessThan(0.01);
    }
  });

  it('leaves the first bar as the count-in and plays to the end of a short track', () => {
    const chart = buildLibraryChart(beatmap(72, 400, 90_000), 'hard', 90_000);
    expect(chart).not.toBeNull();
    if (!chart) return;
    const barMs = BEATS_PER_BAR * chart.beatMs;
    expect(chart.notes[0]).toBeGreaterThanOrEqual(barMs - 1);
    expect(chart.durationMs).toBeCloseTo(90_000 - chart.audioOriginMs, 6);
    expect(chart.notes.every((note) => note < chart.durationMs - chart.beatMs)).toBe(true);
    expect(chart.fadeFromMs).toBeCloseTo(chart.durationMs - SONG_FADE_MS, 6);
  });

  it('cuts a long track after whole bars, with a quiet last bar', () => {
    const chart = buildLibraryChart(beatmap(64, 1000, 240_000), 'easy', 240_000);
    expect(chart).not.toBeNull();
    if (!chart) return;
    const barMs = BEATS_PER_BAR * chart.beatMs;
    expect(chart.durationMs).toBeLessThanOrEqual(SONG_CAP_MS);
    expect(chart.durationMs).toBeGreaterThan(SONG_CAP_MS - barMs);
    expect(Math.abs(chart.durationMs / barMs - Math.round(chart.durationMs / barMs))).toBeLessThan(1e-9);
    expect(chart.notes[chart.notes.length - 1]).toBeLessThan(chart.durationMs - barMs);
  });

  it('gives harder levels more notes, all ascending', () => {
    const map = beatmap(80, 700, 150_000);
    const counts = (['easy', 'normal', 'hard'] as const).map((level) => {
      const chart = buildLibraryChart(map, level, 150_000);
      const notes = chart?.notes ?? [];
      expect(notes.every((note, i) => i === 0 || note > (notes[i - 1] ?? 0))).toBe(true);
      return notes.length;
    });
    expect(counts[0]).toBeLessThan(counts[1] ?? 0);
    expect(counts[1]).toBeLessThan(counts[2] ?? 0);
  });

  it('refuses a beatmap that cannot carry a song', () => {
    expect(buildLibraryChart(beatmap(60, 500, 12_000), 'easy', 12_000)).toBeNull();
    expect(buildLibraryChart({ ...beatmap(60, 500, 60_000), bpm: 0 }, 'easy', 60_000)).toBeNull();
    expect(buildLibraryChart(beatmap(60, 500, 60_000), 'easy', 0)).toBeNull();
  });
});

describe('library track pick', () => {
  it('skips recent tracks while others remain', () => {
    const ids = ['a', 'b', 'c'];
    for (const r of [0, 0.5, 0.99]) expect(pickLibraryTrack(ids, ['a', 'b'], () => r)).toBe('c');
    expect(['a', 'b']).toContain(pickLibraryTrack(['a', 'b'], ['a', 'b'], () => 0.7));
    expect(pickLibraryTrack([], [], () => 0)).toBeNull();
  });

  it('remembers the most recent first, without duplicates, up to the limit', () => {
    let recent: string[] = [];
    for (const id of ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g']) recent = rememberPlayed(recent, id);
    expect(recent[0]).toBe('g');
    expect(recent).toHaveLength(RECENT_TRACKS);
    expect(new Set(recent).size).toBe(recent.length);
  });

  it('reads back only a list of short strings', () => {
    expect(parseRecentTracks({ a: 1 })).toBeNull();
    expect(parseRecentTracks(['m001', 3, '', 'm002'])).toEqual(['m001', 'm002']);
  });
});
