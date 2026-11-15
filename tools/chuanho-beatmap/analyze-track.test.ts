import { describe, expect, it } from 'vitest';
import { analyzeTrack, type Beatmap } from './analyze-track';
import { MIN_GAP_MS, TAIL_MS, enforceMinGap } from './beatmap-levels';
import { parseLibraryManifest } from './library-manifest';
import { ANALYSIS_RATE } from './onset-envelope';
import { type ClickTrackOptions, clickTrack } from './synthetic-click-track';
import { MAX_BPM, MIN_BPM, foldTempo } from './tempo-grid';

function analyse(options: ClickTrackOptions): Beatmap {
  return analyzeTrack('t1', clickTrack(options)).beatmap;
}

function gaps(times: readonly number[]): number[] {
  return times.slice(1).map((t, i) => t - (times[i] ?? 0));
}

describe('foldTempo', () => {
  it('halves or doubles into one playable octave', () => {
    expect(foldTempo(72)).toBe(72);
    expect(foldTempo(140)).toBe(70);
    expect(foldTempo(50)).toBe(100);
    expect(foldTempo(240)).toBe(60);
    for (const bpm of [41, 55, 109.9, 110, 219]) {
      expect(foldTempo(bpm)).toBeGreaterThanOrEqual(MIN_BPM);
      expect(foldTempo(bpm)).toBeLessThan(MAX_BPM);
    }
    expect(foldTempo(0)).toBeNaN();
  });
});

describe('analyzeTrack on click tracks', () => {
  const cases: ClickTrackOptions[] = [
    { bpm: 60, offsetMs: 500, durationMs: 60_000 },
    { bpm: 72, offsetMs: 1234, durationMs: 60_000, accent: 1.6 },
    { bpm: 96.5, offsetMs: 2100, durationMs: 60_000, accent: 1.4 },
    { bpm: 80, offsetMs: 777, durationMs: 60_000, drone: 0.2, noise: 0.05 },
  ];
  for (const options of cases) {
    it(`finds ${options.bpm} BPM and the first beat at ${options.offsetMs} ms`, () => {
      const map = analyse(options);
      expect(map.playable).toBe(true);
      expect(map.confidence).toBeGreaterThan(0.9);
      expect(Math.abs(map.bpm - options.bpm)).toBeLessThan(1);
      expect(Math.abs(map.offsetMs - options.offsetMs)).toBeLessThan(20);
    });
  }

  it('folds a fast pulse to half time and a slow one to double time', () => {
    const fast = analyse({ bpm: 140, offsetMs: 800, durationMs: 60_000 });
    expect(Math.abs(fast.bpm - 70)).toBeLessThan(1);
    expect(fast.playable).toBe(true);
    const slow = analyse({ bpm: 50, offsetMs: 300, durationMs: 90_000 });
    expect(Math.abs(slow.bpm - 100)).toBeLessThan(1);
    expect(slow.playable).toBe(true);
    // The easy level plays every second beat of the doubled grid: the real, audible pulse.
    expect(Math.abs(slow.offsetMs - 300)).toBeLessThan(20);
    for (const gap of gaps(slow.levels?.easy ?? [])) expect(Math.abs(gap - 1200)).toBeLessThanOrEqual(1);
  });

  it('is deterministic', () => {
    const options: ClickTrackOptions = { bpm: 88, offsetMs: 640, durationMs: 45_000, halfBeatLevel: 0.6 };
    expect(analyse(options)).toEqual(analyse(options));
  });
});

describe('levels', () => {
  const options: ClickTrackOptions = { bpm: 90, offsetMs: 1000, durationMs: 60_000, accent: 1.5, halfBeatLevel: 0.6 };
  const map = analyse(options);
  const beatMs = 60_000 / options.bpm;
  const levels = map.levels;

  it('places easy on every second beat, normal on every beat, hard on half beats too', () => {
    expect(levels).toBeDefined();
    if (!levels) return;
    for (const gap of gaps(levels.easy)) expect(Math.abs(gap - 2 * beatMs)).toBeLessThanOrEqual(1);
    const onBeat = (t: number): boolean => {
      const beats = (t - map.offsetMs) / beatMs;
      return Math.abs(beats - Math.round(beats)) * beatMs <= 1;
    };
    const normalBeats = levels.normal.filter(onBeat);
    expect(gaps(normalBeats).every((gap) => Math.abs(gap - beatMs) <= 1)).toBe(true);
    // Normal adds at most a few off-beats; hard takes the half beats the music plays.
    expect(levels.normal.length - normalBeats.length).toBeLessThanOrEqual(Math.ceil(normalBeats.length * 0.1));
    expect(levels.hard.length).toBeGreaterThan(1.8 * normalBeats.length);
    expect(levels.easy.length).toBeLessThan(levels.normal.length);
    expect(levels.normal.length).toBeLessThan(levels.hard.length);
  });

  it('keeps every level ascending, apart by its minimum gap, and out of the fade-out', () => {
    expect(levels).toBeDefined();
    if (!levels) return;
    for (const name of ['easy', 'normal', 'hard'] as const) {
      const times = levels[name];
      for (const gap of gaps(times)) expect(gap).toBeGreaterThanOrEqual(MIN_GAP_MS[name]);
      expect(times[0]).toBeGreaterThanOrEqual(map.offsetMs);
      expect(times[times.length - 1]).toBeLessThanOrEqual(options.durationMs - TAIL_MS);
      expect(times.every(Number.isInteger)).toBe(true);
    }
  });

  it('enforceMinGap drops notes too close to the previous kept one', () => {
    expect(enforceMinGap([0, 100, 300, 350, 700], 250)).toEqual([0, 300, 700]);
  });
});

describe('low confidence', () => {
  it('rejects clicks with no pulse', () => {
    const map = analyse({ bpm: 80, offsetMs: 777, durationMs: 60_000, randomTimes: true });
    expect(map.playable).toBe(false);
    expect(map.confidence).toBeLessThan(0.5);
    expect(map.levels).toBeUndefined();
  });

  it('rejects silence, plain noise and a track too short to play', () => {
    const silence = new Float32Array(ANALYSIS_RATE * 30);
    expect(analyzeTrack('s', silence).beatmap.playable).toBe(false);
    let seed = 12345;
    const noise = Float32Array.from({ length: ANALYSIS_RATE * 30 }, () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648 - 0.5) * 0.6;
    });
    expect(analyzeTrack('n', noise).beatmap.playable).toBe(false);
    expect(analyse({ bpm: 72, offsetMs: 500, durationMs: 12_000 }).playable).toBe(false);
  });
});

describe('parseLibraryManifest', () => {
  it('keeps safe, unique entries and reports the rest', () => {
    const parsed = parseLibraryManifest({
      tracks: [
        { id: 'm001', file: 'm001-ab12cd34.mp3' },
        { id: 'm001', file: 'm001-other.mp3' },
        { id: 'm002', file: '../secret.mp3' },
        { id: 'bad id', file: 'x.mp3' },
        'nonsense',
        { id: 'm003', file: 'm003.ogg' },
      ],
    });
    expect(parsed.tracks).toEqual([
      { id: 'm001', file: 'm001-ab12cd34.mp3' },
      { id: 'm003', file: 'm003.ogg' },
    ]);
    expect(parsed.skipped).toHaveLength(4);
    expect(() => parseLibraryManifest({ files: [] })).toThrow();
  });
});
