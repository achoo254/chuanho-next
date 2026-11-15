import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY,
  MIN_REPEAT_GAP_S,
  type PlayHistory,
  addListened,
  markStarted,
  parsePlayHistory,
  pickNextTrack,
  pruneHistory,
} from './music-play-history';

interface Track {
  readonly id: string;
  readonly duration: number;
}

/** A deterministic generator, so a failing simulation can be replayed. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A library like the real one: 120–180 s tracks adding up to about 4.2 hours. */
function library(totalS: number, random: () => number): Track[] {
  const tracks: Track[] = [];
  for (let sum = 0; sum < totalS; ) {
    const duration = 120 + Math.floor(random() * 61);
    tracks.push({ id: `m${tracks.length + 1}`, duration });
    sum += duration;
  }
  return tracks;
}

/**
 * Plays `hours` of music track after track (each heard to the end), reloading the page every `reloadEveryS`
 * (the history goes through JSON like localStorage), and returns the smallest listening gap between two plays of
 * the same track, plus how many tracks played before the first repeat.
 */
function simulate(tracks: readonly Track[], hours: number, seed: number, reloadEveryS = Infinity): { minGap: number; firstRepeatAt: number } {
  const random = seeded(seed);
  let history: PlayHistory = EMPTY_HISTORY;
  const startedAt = new Map<string, number>();
  let minGap = Infinity;
  let firstRepeatAt = -1;
  let plays = 0;
  let sinceReload = 0;
  while (history.clock < hours * 3600) {
    const track = pickNextTrack(tracks, history, random);
    if (!track) throw new Error('empty pick');
    const before = startedAt.get(track.id);
    if (before !== undefined) {
      minGap = Math.min(minGap, history.clock - before);
      if (firstRepeatAt < 0) firstRepeatAt = plays;
    }
    startedAt.set(track.id, history.clock);
    history = addListened(markStarted(history, track.id), track.duration);
    plays += 1;
    sinceReload += track.duration;
    if (sinceReload >= reloadEveryS) {
      sinceReload = 0;
      history = parsePlayHistory(JSON.parse(JSON.stringify(history))) ?? EMPTY_HISTORY;
    }
  }
  return { minGap, firstRepeatAt };
}

describe('pickNextTrack', () => {
  it('returns null for an empty library', () => {
    expect(pickNextTrack([], EMPTY_HISTORY)).toBeNull();
  });

  it('plays every track once before any repeats', () => {
    const tracks = library(4.2 * 3600, seeded(1));
    const { firstRepeatAt } = simulate(tracks, 4.3, 7);
    expect(firstRepeatAt).toBe(tracks.length);
  });

  it('never repeats a track within four hours over 4.2 hours of continuous play, and well beyond', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const tracks = library(4.2 * 3600, seeded(seed * 31));
      // 4.2 h covers the first pass; 72 h checks the steady state after many passes.
      const { minGap } = simulate(tracks, 72, seed);
      expect(minGap).toBeGreaterThanOrEqual(MIN_REPEAT_GAP_S);
    }
  });

  it('keeps the promise across page reloads', () => {
    const tracks = library(4.2 * 3600, seeded(9));
    const { minGap, firstRepeatAt } = simulate(tracks, 30, 11, 20 * 60);
    expect(firstRepeatAt).toBe(tracks.length);
    expect(minGap).toBeGreaterThanOrEqual(MIN_REPEAT_GAP_S);
  });

  it('plays a track added to the library before replaying old ones', () => {
    let history: PlayHistory = EMPTY_HISTORY;
    for (const id of ['a', 'b']) history = addListened(markStarted(history, id), 100);
    const next = pickNextTrack([{ id: 'a' }, { id: 'b' }, { id: 'new' }], history, () => 0.99);
    expect(next?.id).toBe('new');
  });

  it('falls back to the track heard longest ago when the library is shorter than the gap', () => {
    let history: PlayHistory = EMPTY_HISTORY;
    for (const id of ['b', 'a', 'c']) history = addListened(markStarted(history, id), 100);
    expect(pickNextTrack([{ id: 'a' }, { id: 'b' }, { id: 'c' }], history, () => 0.5)?.id).toBe('b');
  });

  it('never hands back the track that just started, even with an extreme random value', () => {
    const tracks = [{ id: 'a' }, { id: 'b' }];
    let history = addListened(markStarted(EMPTY_HISTORY, 'a'), 10);
    history = addListened(markStarted(history, 'b'), 10);
    expect(pickNextTrack(tracks, history, () => 0.999999)?.id).toBe('a');
  });
});

describe('history bookkeeping', () => {
  it('ignores negative and non-finite listening time', () => {
    expect(addListened(EMPTY_HISTORY, -3)).toBe(EMPTY_HISTORY);
    expect(addListened(EMPTY_HISTORY, Number.NaN)).toBe(EMPTY_HISTORY);
    expect(addListened(EMPTY_HISTORY, 5).clock).toBe(5);
  });

  it('prunes tracks that left the library', () => {
    const history = markStarted(markStarted(EMPTY_HISTORY, 'a'), 'gone');
    expect(Object.keys(pruneHistory(history, new Set(['a'])).last)).toEqual(['a']);
  });

  it('parses stored data defensively', () => {
    expect(parsePlayHistory(null)).toBeNull();
    expect(parsePlayHistory('x')).toBeNull();
    expect(parsePlayHistory({ clock: -1, last: {} })).toBeNull();
    expect(parsePlayHistory({ clock: 10, last: [] })).toBeNull();
    expect(parsePlayHistory({ clock: 10, last: { a: 5, b: 'x', c: 50, d: -1 } })).toEqual({ clock: 10, last: { a: 5 } });
  });
});
