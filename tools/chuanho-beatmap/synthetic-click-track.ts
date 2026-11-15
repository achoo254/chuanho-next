/**
 * Synthetic test audio for the beatmap tests (no audio files in the repo): a click track at a known tempo and
 * offset, with optional accents, off-beat clicks, a soft drone and noise. Deterministic (seeded noise).
 */
import { ANALYSIS_RATE } from './onset-envelope';

export interface ClickTrackOptions {
  readonly bpm: number;
  /** Time of the first click, ms. */
  readonly offsetMs: number;
  readonly durationMs: number;
  /** Level of every fourth click relative to the others (1 = no accent). */
  readonly accent?: number;
  /** Level of a click on every half beat (0 = none). */
  readonly halfBeatLevel?: number;
  /** Level of a steady sine drone under the clicks (0 = none). */
  readonly drone?: number;
  /** Level of white noise over the whole track (0 = none). */
  readonly noise?: number;
  /** Clicks at random times instead of on a grid (a track with no pulse). */
  readonly randomTimes?: boolean;
  readonly seed?: number;
}

/** mulberry32: a small seeded PRNG. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds a short percussive click (a decaying 1.2 kHz tone plus a noise transient) at `ms`. */
function addClick(out: Float32Array, ms: number, level: number, random: () => number): void {
  const start = Math.round((ms / 1000) * ANALYSIS_RATE);
  const length = Math.round(0.04 * ANALYSIS_RATE);
  for (let i = 0; i < length; i += 1) {
    const at = start + i;
    if (at < 0 || at >= out.length) continue;
    const decay = Math.exp(-i / (0.006 * ANALYSIS_RATE));
    const tone = Math.sin((2 * Math.PI * 1200 * i) / ANALYSIS_RATE);
    out[at] = (out[at] ?? 0) + level * decay * (0.7 * tone + 0.3 * (random() * 2 - 1));
  }
}

/** Mono samples at ANALYSIS_RATE. */
export function clickTrack(options: ClickTrackOptions): Float32Array {
  const random = seeded(options.seed ?? 7);
  const out = new Float32Array(Math.round((options.durationMs / 1000) * ANALYSIS_RATE));
  const beatMs = 60_000 / options.bpm;
  const accent = options.accent ?? 1;
  const drone = options.drone ?? 0;
  const noise = options.noise ?? 0;
  for (let i = 0; i < out.length; i += 1) {
    const t = i / ANALYSIS_RATE;
    out[i] = drone * Math.sin(2 * Math.PI * 110 * t) + noise * (random() * 2 - 1);
  }
  if (options.randomTimes) {
    const count = Math.round(options.durationMs / beatMs);
    for (let n = 0; n < count; n += 1) addClick(out, options.offsetMs + random() * (options.durationMs - options.offsetMs), 0.5, random);
    return out;
  }
  for (let n = 0; options.offsetMs + n * beatMs < options.durationMs - 50; n += 1) {
    const t = options.offsetMs + n * beatMs;
    addClick(out, t, n % 4 === 0 ? 0.5 * accent : 0.5, random);
    const half = options.halfBeatLevel ?? 0;
    if (half > 0) addClick(out, t + beatMs / 2, 0.5 * half, random);
  }
  return out;
}
