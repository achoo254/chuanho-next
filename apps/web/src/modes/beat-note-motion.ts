/**
 * The moving parts of the Mõ Beat effects as pure functions of time, so they can be tested and replayed exactly:
 * the beat pulse that makes the target ring and the screen breathe, which notes are the bar's accent (drawn as
 * lanterns instead of lotuses), the ring that closes in on the wooden fish as a note arrives, the comet tail behind
 * a flying note, and the petals and sparkles that burst out of a hit.
 */
import { PERFECT_WINDOW_MS } from '../game/grade-tap';

/** How long after each beat the pulse takes to fade, as a share of one beat. */
const PULSE_DECAY = 0.22;

/** 1 exactly on a beat, easing to 0 before the next one; 0 before the song's first beat. */
export function beatPulse(songMs: number, beatMs: number): number {
  if (!Number.isFinite(songMs) || !(beatMs > 0) || songMs < 0) return 0;
  const phase = (songMs % beatMs) / beatMs;
  return Math.exp(-phase / PULSE_DECAY);
}

/** Notes on the first beat of a bar (four beats) are the accents. */
export function isAccentNote(noteMs: number, beatMs: number): boolean {
  if (!(beatMs > 0)) return false;
  return Math.round(noteMs / beatMs) % 4 === 0;
}

/** The closing ring shows over the last APPROACH_MS before a note lands. */
export const APPROACH_MS = 520;

/** Scale and opacity of the closing ring `aheadMs` before the next note: wide and faint, then tight and bright. */
export function approachRing(aheadMs: number): { scale: number; alpha: number } {
  if (!Number.isFinite(aheadMs) || aheadMs > APPROACH_MS || aheadMs < 0) return { scale: 1, alpha: 0 };
  const t = 1 - aheadMs / APPROACH_MS;
  // Inside the PERFECT window the ring sits exactly on the halo and glows brighter: tapping while it is inside the
  // circle is the high score. Before that it closes in from wide and faint.
  if (aheadMs <= PERFECT_WINDOW_MS) return { scale: 1, alpha: 0.9 };
  const closing = (aheadMs - PERFECT_WINDOW_MS) / (APPROACH_MS - PERFECT_WINDOW_MS);
  return { scale: 1 + closing * 0.9, alpha: Math.min(1, t * 1.6) * 0.6 };
}

/** The comet tail: how far back along the path each trailing sparkle sits (in flight progress) and how big it is. */
export const TRAIL_STEPS = 5;
export function trailStep(step: number): { lag: number; scale: number; alpha: number } {
  const k = (step + 1) / (TRAIL_STEPS + 1);
  return { lag: (step + 1) * 0.045, scale: 1 - k * 0.75, alpha: (1 - k) * 0.75 };
}

export type BurstGrade = 'perfect' | 'good';
export const BURST_MS = 760;
export const BURST_PETALS: Readonly<Record<BurstGrade, number>> = { perfect: 10, good: 6 };
export const BURST_SPARKLES: Readonly<Record<BurstGrade, number>> = { perfect: 6, good: 3 };

export interface BurstPiece {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly size: number;
  readonly angle: number;
  readonly alpha: number;
}

const GOLDEN_ANGLE = 2.399963;

/**
 * A petal `ageMs` into a burst: thrown out and up round the wooden fish, spinning, then dropping under a soft gravity
 * and fading. `index` spreads the petals evenly round the ring with a little per-petal variety.
 */
export function burstPetal(index: number, count: number, ageMs: number, reducedMotion: boolean): BurstPiece | null {
  if (ageMs < 0 || ageMs >= BURST_MS || count <= 0) return null;
  const t = ageMs / BURST_MS;
  const s = ageMs / 1000;
  const heading = (index / count) * Math.PI * 2 + 0.4;
  const variety = 0.75 + 0.5 * Math.abs(Math.sin(index * GOLDEN_ANGLE));
  const speed = reducedMotion ? 0 : 1.15 * variety;
  const out = speed * s * (1 - t * 0.45);
  const lift = reducedMotion ? 0 : 1.25 * variety * s - 2.2 * s * s;
  const size = 0.24 * variety * (t < 0.12 ? t / 0.12 : 1) * (1 - t * 0.35);
  return {
    x: Math.cos(heading) * out,
    y: lift,
    z: Math.sin(heading) * out,
    size,
    angle: heading + (reducedMotion ? 0 : s * 7 * (index % 2 === 0 ? 1 : -1)),
    alpha: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4,
  };
}

/** A sparkle `ageMs` into a burst: a quick twinkle that shoots up and out, faster and shorter-lived than the petals. */
export function burstSparkle(index: number, count: number, ageMs: number, reducedMotion: boolean): BurstPiece | null {
  const life = BURST_MS * 0.7;
  if (ageMs < 0 || ageMs >= life || count <= 0) return null;
  const t = ageMs / life;
  const heading = (index / count) * Math.PI * 2 + index * 0.9;
  const reach = reducedMotion ? 0 : 0.55 * Math.sin(t * Math.PI * 0.5);
  return {
    x: Math.cos(heading) * reach,
    y: (reducedMotion ? 0 : 0.5) * t + 0.05,
    z: Math.sin(heading) * reach * 0.6,
    size: 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.2)),
    angle: t * 2.5,
    alpha: 1 - t * t,
  };
}

/** The bright flash and the ripple at the hit point: both swell and fade over the first part of the burst. */
export function burstFlash(ageMs: number): { scale: number; alpha: number } {
  const life = BURST_MS * 0.5;
  if (ageMs < 0 || ageMs >= life) return { scale: 0, alpha: 0 };
  const t = ageMs / life;
  return { scale: 0.5 + t * 1.3, alpha: (1 - t) * (1 - t) };
}
