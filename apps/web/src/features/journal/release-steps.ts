/**
 * Pure rules of releasing one "karma cloud" (gỡ khẩu nghiệp): three steps in a fixed order (reset with 21 strokes of
 * the wooden fish, a gentle apology the player sends themself, one kind deed in real life). Any step can be skipped
 * and the flow closed at any time; the cloud dissolves only when all three are done. No step is ever undone.
 */
import { type JournalEntry, RELEASE_STEPS, type ReleaseStep } from '@chuanho/contract';

/** Strokes of the reset step (21, a traditional small round). */
export const RESET_STROKES = 21;

/** The step to open a flow on: the first one not done yet, or null when the cloud has already dissolved. */
export function firstOpenStep(entry: Pick<JournalEntry, 'released'>): ReleaseStep | null {
  return RELEASE_STEPS.find((step) => !entry.released[step]) ?? null;
}

/** The step after `current` (done or skipped) that is still open, or null when the flow has nothing left after it. */
export function nextOpenStep(entry: Pick<JournalEntry, 'released'>, current: ReleaseStep): ReleaseStep | null {
  const after = RELEASE_STEPS.slice(RELEASE_STEPS.indexOf(current) + 1);
  return after.find((step) => !entry.released[step]) ?? null;
}

/** How many of the three steps are done (the dots under a cloud). */
export const doneStepCount = (entry: Pick<JournalEntry, 'released'>): number => RELEASE_STEPS.filter((step) => entry.released[step]).length;

/** Strokes counted so far, never past the goal (extra taps after 21 do nothing). */
export const addStroke = (count: number): number => Math.min(RESET_STROKES, count + 1);

/** The progress ring's fill, 0 to 1. */
export const strokeFraction = (count: number): number => Math.max(0, Math.min(1, count / RESET_STROKES));

export const isResetComplete = (count: number): boolean => count >= RESET_STROKES;

