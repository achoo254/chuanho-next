/**
 * The three Mõ Beat levels of a track, placed on its beat grid (times in ms from the start of the audio file):
 * - easy: every second beat, starting on a downbeat;
 * - normal: every beat, plus a few half beats where the music has its strongest off-beat onsets;
 * - hard: every beat, plus every half beat the music supports with a real onset.
 * No two notes of a level are closer than its minimum gap. Pure and deterministic.
 */
import type { OnsetEnvelope } from './onset-envelope';
import { type BeatGrid, envelopeAt, frameOf, smoothEnvelope } from './tempo-grid';

export type LevelName = 'easy' | 'normal' | 'hard';
export type BeatmapLevels = Readonly<Record<LevelName, readonly number[]>>;

/** Smallest gap between two notes of a level, in ms. */
export const MIN_GAP_MS: Readonly<Record<LevelName, number>> = { easy: 900, normal: 300, hard: 250 };
/** Normal takes at most this share of half beats (the strongest ones). */
const NORMAL_OFFBEAT_SHARE = 0.1;
/** Half beats need at least this much of the median beat's strength (normal, then hard). */
const NORMAL_OFFBEAT_STRENGTH = 1;
const HARD_OFFBEAT_STRENGTH = 0.6;
/** No notes in the last seconds of a track (its fade-out). */
export const TAIL_MS = 3000;

export interface LevelInput {
  readonly envelope: OnsetEnvelope;
  readonly grid: BeatGrid;
  /** The first downbeat (ms); notes start there. */
  readonly downbeatMs: number;
  readonly durationMs: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** Keeps the sorted times that are at least `gap` after the previous kept one. */
export function enforceMinGap(times: readonly number[], gap: number): number[] {
  const kept: number[] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const previous = kept[kept.length - 1];
    if (previous === undefined || t - previous >= gap) kept.push(t);
  }
  return kept;
}

export function generateLevels(input: LevelInput): BeatmapLevels {
  const { envelope, grid, downbeatMs, durationMs } = input;
  const smooth = smoothEnvelope(envelope.strength);
  const activeEndMs = envelope.activeEnd * envelope.frameMs + envelope.timeOffsetMs;
  const lastMs = Math.min(activeEndMs, durationMs - TAIL_MS);
  const strengthAt = (ms: number): number => {
    const centre = frameOf(envelope, ms);
    let peak = 0;
    for (let d = -1.5; d <= 1.5; d += 0.5) peak = Math.max(peak, envelopeAt(smooth, centre + d));
    return peak;
  };

  const beats: number[] = [];
  for (let n = 0; downbeatMs + n * grid.beatMs <= lastMs; n += 1) beats.push(downbeatMs + n * grid.beatMs);
  const beatMedian = median(beats.map(strengthAt)) || 1;
  // Half beats strictly inside the playable span, with their strength relative to a typical beat.
  const halves = beats
    .slice(0, -1)
    .map((t) => t + grid.beatMs / 2)
    .map((t) => ({ t, strength: strengthAt(t) / beatMedian }));

  const strongestFirst = [...halves].sort((a, b) => b.strength - a.strength || a.t - b.t);
  const normalCount = Math.floor(halves.length * NORMAL_OFFBEAT_SHARE);
  const normalHalves = strongestFirst.slice(0, normalCount).filter((h) => h.strength >= NORMAL_OFFBEAT_STRENGTH).map((h) => h.t);
  const hardHalves = halves.filter((h) => h.strength >= HARD_OFFBEAT_STRENGTH).map((h) => h.t);

  // Whole milliseconds first, so the gap rule holds on the stored values.
  const level = (times: readonly number[], gap: number): number[] => enforceMinGap(times.map((t) => Math.round(t)), gap);
  return {
    easy: level(beats.filter((_, n) => n % 2 === 0), MIN_GAP_MS.easy),
    normal: level([...beats, ...normalHalves], MIN_GAP_MS.normal),
    hard: level([...beats, ...hardHalves], MIN_GAP_MS.hard),
  };
}
