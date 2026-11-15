/**
 * Timing of one shield against the gusts of "Hộ hương": a tap on the gust's side from `EARLY_WINDOW_MS` before it lands
 * to `LATE_WINDOW_MS` after shields the flame (PERFECT close to the moment, GOOD earlier), a tap on the wrong side
 * while a gust is coming lets it through. Each gust is judged once. Pure, like game/grade-tap.ts.
 */
import type { Gust, GustSide } from './gust-schedule';

export const EARLY_WINDOW_MS = 700;
export const LATE_WINDOW_MS = 150;
/** A shield this close before the landing (or any time after, within the late window) is PERFECT. */
export const PERFECT_EARLY_MS = 220;

export type GustGrade = 'perfect' | 'good' | 'miss';
export type GustMark = 'pending' | GustGrade;

/** The grade of a shield `deltaMs` from the landing (negative = early), or null outside the window. */
export function gradeShield(deltaMs: number): Exclude<GustGrade, 'miss'> | null {
  if (!Number.isFinite(deltaMs) || deltaMs < -EARLY_WINDOW_MS || deltaMs > LATE_WINDOW_MS) return null;
  return deltaMs >= -PERFECT_EARLY_MS ? 'perfect' : 'good';
}

export type TapMatch =
  | { readonly kind: 'shield'; readonly index: number; readonly grade: Exclude<GustGrade, 'miss'> }
  | { readonly kind: 'wrong-side'; readonly index: number }
  | { readonly kind: 'none' };

/** The pending gust nearest to `tapMs` whose window holds it, on `side` only (or on any side when null), or -1. */
function nearestPending(gusts: readonly Gust[], marks: readonly GustMark[], side: GustSide | null, tapMs: number): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  gusts.forEach((gust, index) => {
    if (marks[index] !== 'pending' || (side !== null && gust.side !== side)) return;
    if (gradeShield(tapMs - gust.atMs) === null) return;
    const distance = Math.abs(tapMs - gust.atMs);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/** What a tap on `side` at `tapMs` does: shields the nearest gust of that side, lets a gust of the other side in, or nothing. */
export function matchTap(gusts: readonly Gust[], marks: readonly GustMark[], side: GustSide, tapMs: number): TapMatch {
  const same = nearestPending(gusts, marks, side, tapMs);
  const gust = gusts[same];
  if (gust) {
    const grade = gradeShield(tapMs - gust.atMs);
    if (grade) return { kind: 'shield', index: same, grade };
  }
  const other = nearestPending(gusts, marks, null, tapMs);
  return other >= 0 ? { kind: 'wrong-side', index: other } : { kind: 'none' };
}

/** The pending gusts whose window has closed by `nowMs` (nobody shielded them), in time order. */
export function expiredGusts(gusts: readonly Gust[], marks: readonly GustMark[], nowMs: number): number[] {
  return gusts.flatMap((gust, index) => (marks[index] === 'pending' && nowMs - gust.atMs > LATE_WINDOW_MS ? [index] : []));
}
