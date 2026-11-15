/**
 * Timing judgement of one tap against the note it aims at. Pure, so the windows are tested in isolation and the
 * rhythm screen, the judge and the tests all read the same numbers.
 */

/**
 * A tap this close to its note (either side) is PERFECT: the stretch in which the closing ring sits inside the lotus
 * halo (modes/beat-note-motion.ts keeps it locked there), so "inside the circle" is the high score.
 */
export const PERFECT_WINDOW_MS = 80;
/** A tap this close to its note (either side) is GOOD; further out it is a miss. */
export const GOOD_WINDOW_MS = 130;
/**
 * A tap with no note this close is mashing, not aiming: it breaks the combo and earns nothing. Wider than the GOOD
 * window so a slightly late tap still counts as a miss of that note rather than as mashing.
 */
export const MASH_WINDOW_MS = 170;

export type TapGrade = 'perfect' | 'good' | 'miss';

/** Grade of a tap `deltaMs` away from its note (negative = early, positive = late). */
export function gradeTap(deltaMs: number): TapGrade {
  if (!Number.isFinite(deltaMs)) return 'miss';
  const distance = Math.abs(deltaMs);
  if (distance <= PERFECT_WINDOW_MS) return 'perfect';
  if (distance <= GOOD_WINDOW_MS) return 'good';
  return 'miss';
}
