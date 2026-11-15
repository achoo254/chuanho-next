/**
 * Note charts of the rhythm mode, generated on the beat grid of the synthesized backing track. The music and the
 * chart share one BPM and one start time, so every note sits exactly on a beat or half beat the player can hear.
 *
 * Pure and seeded: the same difficulty and seed always give the same chart, which keeps it testable and lets a
 * player replay the exact song.
 */

export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultySpec {
  readonly bpm: number;
  /** Chance that a beat which is not a bar's downbeat carries a note. */
  readonly beatChance: number;
  /** Chance of an extra note on the half beat after a note (only where the spacing allows). */
  readonly halfBeatChance: number;
  /** Smallest gap between two notes, in beats. */
  readonly minGapBeats: number;
}

export const DIFFICULTY_SPECS: Readonly<Record<Difficulty, DifficultySpec>> = {
  easy: { bpm: 72, beatChance: 0.35, halfBeatChance: 0, minGapBeats: 1 },
  normal: { bpm: 90, beatChance: 0.8, halfBeatChance: 0, minGapBeats: 1 },
  hard: { bpm: 110, beatChance: 0.9, halfBeatChance: 0.3, minGapBeats: 0.5 },
};

export const BEATS_PER_BAR = 4;
/** One bar of count-in (the pulse only) before the first note. */
export const COUNT_IN_BARS = 1;
/** One quiet bar at the end so the last note is not cut by the fade-out. */
export const OUTRO_BARS = 1;
/** Target song length; rounded to whole bars. */
export const TARGET_SONG_MS = 60_000;

export interface BeatChart {
  readonly difficulty: Difficulty;
  readonly bpm: number;
  readonly beatMs: number;
  /** Whole song including count-in and outro, in ms from the song start. */
  readonly durationMs: number;
  /** Note times in ms from the song start, ascending. */
  readonly notes: readonly number[];
}

/** Small seeded PRNG (mulberry32): deterministic charts without a dependency. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Number of bars that make a song of about TARGET_SONG_MS at `bpm`. */
export function songBars(bpm: number): number {
  const barMs = (60_000 / bpm) * BEATS_PER_BAR;
  return Math.max(COUNT_IN_BARS + OUTRO_BARS + 1, Math.round(TARGET_SONG_MS / barMs));
}

/** The note chart of one song. `seed` picks among equally valid charts; the default is the song everyone gets. */
export function generateBeatChart(difficulty: Difficulty, seed = 1): BeatChart {
  const spec = DIFFICULTY_SPECS[difficulty];
  const beatMs = 60_000 / spec.bpm;
  const bars = songBars(spec.bpm);
  const random = seededRandom(seed * 7919 + DIFFICULTIES.indexOf(difficulty));
  const firstBeat = COUNT_IN_BARS * BEATS_PER_BAR;
  const lastBeat = (bars - OUTRO_BARS) * BEATS_PER_BAR; // exclusive
  const minGapMs = spec.minGapBeats * beatMs;

  const notes: number[] = [];
  const push = (beat: number): void => {
    const time = beat * beatMs;
    const previous = notes[notes.length - 1];
    // A tiny tolerance absorbs floating-point noise of beat * beatMs.
    if (previous === undefined || time - previous >= minGapMs - 1e-6) notes.push(time);
  };

  for (let beat = firstBeat; beat < lastBeat; beat += 1) {
    const downbeat = beat % BEATS_PER_BAR === 0;
    if (downbeat || random() < spec.beatChance) {
      push(beat);
      // The half beat after a note, never past the last playable beat.
      if (spec.halfBeatChance > 0 && beat + 1 < lastBeat && random() < spec.halfBeatChance) push(beat + 0.5);
    }
  }

  return { difficulty, bpm: spec.bpm, beatMs, durationMs: bars * BEATS_PER_BAR * beatMs, notes };
}
