/**
 * Tempo and beat grid from an onset envelope: autocorrelation scored at the first few multiples of each candidate
 * period (a comb, so the true pulse beats its own fractions), folded into one octave of playable tempo, then a fine
 * search of tempo and phase that puts the most onset strength on a rigid grid over the whole track. The library's
 * tracks are generated at a fixed tempo, so one rigid grid is the honest model; a drifting track fails the
 * steadiness check later instead of being chased.
 *
 * Pure and deterministic.
 */
import type { OnsetEnvelope } from './onset-envelope';

/**
 * Playable tempo range, one octave wide so every detected pulse folds into it exactly once (a half- or double-time
 * reading of the same music lands on the same tempo). The library is prompted at 50-66 BPM; the music's pulse
 * at 55-110 suits the three levels (easy plays every second beat, hard adds half beats).
 */
export const MIN_BPM = 55;
export const MAX_BPM = 110;
const SEARCH_MIN_BPM = 40;
const SEARCH_MAX_BPM = 220;
const COMB_MULTIPLES = 4;
export const BEATS_PER_BAR = 4;

export interface BeatGrid {
  readonly bpm: number;
  readonly beatMs: number;
  /** Time (ms) of one beat of the grid; every beat is `phaseMs + n * beatMs`. */
  readonly phaseMs: number;
  /** Mean smoothed onset strength on the grid's beats (how well it fits). */
  readonly score: number;
}

/** Folds a tempo into [MIN_BPM, MAX_BPM) by halving or doubling. */
export function foldTempo(bpm: number): number {
  if (!(bpm > 0) || !Number.isFinite(bpm)) return NaN;
  let folded = bpm;
  while (folded >= MAX_BPM) folded /= 2;
  while (folded < MIN_BPM) folded *= 2;
  return folded;
}

/** Envelope value at a fractional frame (linear interpolation; 0 outside). */
export function envelopeAt(strength: Float32Array, frame: number): number {
  const i = Math.floor(frame);
  if (i < 0 || i + 1 >= strength.length) return i === strength.length - 1 ? (strength[i] ?? 0) : 0;
  const t = frame - i;
  return (strength[i] ?? 0) * (1 - t) + (strength[i + 1] ?? 0) * t;
}

/** A lightly smoothed copy ([1 2 1]/4 twice), so the grid search sees hills instead of single-frame spikes. */
export function smoothEnvelope(strength: Float32Array): Float32Array {
  let current = strength;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Float32Array(current.length);
    for (let i = 0; i < current.length; i += 1) {
      next[i] = 0.25 * (current[i - 1] ?? current[i] ?? 0) + 0.5 * (current[i] ?? 0) + 0.25 * (current[i + 1] ?? current[i] ?? 0);
    }
    current = next;
  }
  return current;
}

/** The dominant pulse in BPM (before folding), from a comb over the envelope's autocorrelation. */
export function coarseTempo(envelope: OnsetEnvelope): number {
  const { strength, activeStart, activeEnd, frameMs } = envelope;
  const frameRate = 1000 / frameMs;
  const length = activeEnd - activeStart;
  const maxLag = Math.ceil(((60 * frameRate) / SEARCH_MIN_BPM) * COMB_MULTIPLES) + 2;
  if (length < maxLag * 2) return NaN;
  let mean = 0;
  for (let i = activeStart; i < activeEnd; i += 1) mean += strength[i] ?? 0;
  mean /= length;
  const centred = new Float64Array(length);
  for (let i = 0; i < length; i += 1) centred[i] = (strength[activeStart + i] ?? 0) - mean;
  const acf = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < length; i += 1) sum += (centred[i] ?? 0) * (centred[i + lag] ?? 0);
    acf[lag] = sum / (length - lag);
  }
  const zero = acf[0] ?? 0;
  if (!(zero > 0)) return NaN;
  const acfAt = (lag: number): number => {
    const i = Math.floor(lag);
    const t = lag - i;
    return ((acf[i] ?? 0) * (1 - t) + (acf[i + 1] ?? 0) * t) / zero;
  };

  let best = NaN;
  let bestScore = -Infinity;
  for (let bpm = SEARCH_MIN_BPM; bpm <= SEARCH_MAX_BPM + 1e-9; bpm += 0.1) {
    const period = (60 * frameRate) / bpm;
    let score = 0;
    for (let k = 1; k <= COMB_MULTIPLES; k += 1) score += acfAt(k * period);
    if (score > bestScore) {
      bestScore = score;
      best = bpm;
    }
  }
  return best;
}

/** Mean smoothed strength on the grid `phase + n * period` (frames) within [start, end). */
function gridScore(smooth: Float32Array, period: number, phase: number, start: number, end: number): number {
  let sum = 0;
  let count = 0;
  const first = Math.ceil((start - phase) / period);
  for (let n = first; ; n += 1) {
    const frame = phase + n * period;
    if (frame >= end) break;
    sum += envelopeAt(smooth, frame);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

/**
 * The rigid beat grid that best fits the envelope: tempo within ±1.5 BPM of `foldedBpm` (0.02 BPM steps), phase
 * over one period (quarter-frame steps).
 */
export function fitBeatGrid(envelope: OnsetEnvelope, foldedBpm: number): BeatGrid | null {
  if (!Number.isFinite(foldedBpm)) return null;
  const { activeStart, activeEnd, frameMs, timeOffsetMs } = envelope;
  const smooth = smoothEnvelope(envelope.strength);
  const frameRate = 1000 / frameMs;
  interface Fit {
    readonly bpm: number;
    readonly phase: number;
    readonly score: number;
  }
  let best: Fit | null = null;
  // Coarse pass over tempo and phase, then a fine pass around the winner.
  const passes: { span: number; bpmStep: number; phaseStep: number }[] = [
    { span: 1.5, bpmStep: 0.05, phaseStep: 1 },
    { span: 0.06, bpmStep: 0.005, phaseStep: 0.25 },
  ];
  for (const pass of passes) {
    const lastBest: Fit | null = best;
    const centre: number = lastBest?.bpm ?? foldedBpm;
    for (let bpm: number = centre - pass.span; bpm <= centre + pass.span + 1e-9; bpm += pass.bpmStep) {
      if (bpm < MIN_BPM || bpm >= MAX_BPM) continue;
      const period = (60 * frameRate) / bpm;
      const [phaseFrom, phaseTo]: [number, number] = lastBest ? [lastBest.phase - 2, lastBest.phase + 2] : [0, period];
      for (let phase: number = phaseFrom; phase < phaseTo; phase += pass.phaseStep) {
        const score = gridScore(smooth, period, phase, activeStart, activeEnd);
        if (!best || score > best.score) best = { bpm, phase, score };
      }
    }
  }
  if (!best) return null;
  const beatMs = 60_000 / best.bpm;
  const phaseMs = best.phase * frameMs + timeOffsetMs;
  return { bpm: best.bpm, beatMs, phaseMs: ((phaseMs % beatMs) + beatMs) % beatMs, score: best.score };
}

/**
 * Tempo ratios tried besides the dominant pulse itself. Octave errors are settled by folding; these settle the
 * three-against-two ones (a pulse with accented half beats can read as two thirds or three halves of its tempo).
 */
const METER_RATIOS = [1, 3 / 2, 2 / 3, 3, 1 / 3] as const;
/** Another reading must fit this much better than the dominant pulse to replace it. */
const METER_MARGIN = 1.05;

/** The best rigid grid among the dominant pulse and its three-against-two readings, all folded. */
export function chooseBeatGrid(envelope: OnsetEnvelope, rawBpm: number): BeatGrid | null {
  let best: BeatGrid | null = null;
  const tried = new Set<number>();
  for (const ratio of METER_RATIOS) {
    const folded = foldTempo(rawBpm * ratio);
    const key = Math.round(folded * 10);
    if (!Number.isFinite(folded) || tried.has(key)) continue;
    tried.add(key);
    const grid = fitBeatGrid(envelope, folded);
    if (grid && (!best || grid.score > best.score * METER_MARGIN)) best = grid;
  }
  return best;
}

/** Frame (fractional) of a time in ms. */
export function frameOf(envelope: OnsetEnvelope, ms: number): number {
  return (ms - envelope.timeOffsetMs) / envelope.frameMs;
}

/**
 * The first downbeat at or after the active span's start: of the four ways to group beats into bars, the one whose
 * first beats carry the most onset strength (ties go to the earliest beat, so the result is deterministic).
 */
export function firstDownbeatMs(envelope: OnsetEnvelope, grid: BeatGrid): number {
  const smooth = smoothEnvelope(envelope.strength);
  const startMs = envelope.activeStart * envelope.frameMs + envelope.timeOffsetMs;
  const endMs = envelope.activeEnd * envelope.frameMs + envelope.timeOffsetMs;
  const firstBeat = grid.phaseMs + Math.ceil((startMs - grid.phaseMs) / grid.beatMs) * grid.beatMs;
  const totals = new Array<number>(BEATS_PER_BAR).fill(0);
  for (let n = 0; firstBeat + n * grid.beatMs < endMs; n += 1) {
    const slot = n % BEATS_PER_BAR;
    totals[slot] = (totals[slot] ?? 0) + envelopeAt(smooth, frameOf(envelope, firstBeat + n * grid.beatMs));
  }
  let bestSlot = 0;
  for (let slot = 1; slot < BEATS_PER_BAR; slot += 1) {
    // A clear margin is needed to move off the first beat: equal accents keep the earliest.
    if ((totals[slot] ?? 0) > (totals[bestSlot] ?? 0) * 1.05) bestSlot = slot;
  }
  return firstBeat + bestSlot * grid.beatMs;
}
