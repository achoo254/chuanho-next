/**
 * The quiet hour's rules, pure: the status the API answers for a moment and a stored total, whether a batch may count,
 * and how much of it fits under the per-person cap. Times and windows come from the contract's helpers.
 */
import {
  QUIET_HOUR_PERSON_CAP,
  type QuietHourBeatsInput,
  type QuietHourStatus,
  isQuietHourNow,
  milestonesReached,
  quietHourWindow,
  vietnamDay,
} from '@chuanho/contract';

/**
 * The status of the Vietnam day that contains `nowMs`: its window (still today's after it ended, so the night's total
 * and milestones show until midnight), whether it is on, and the shared total.
 */
export function quietHourStatus(nowMs: number, total: number): QuietHourStatus {
  const day = vietnamDay(nowMs);
  const { start, end } = quietHourWindow(day);
  return { day, open: isQuietHourNow(nowMs), startsAt: start, endsAt: end, total, milestones: milestonesReached(total), serverNow: nowMs };
}

/** A batch counts only while the half hour is on, and only for tonight (not a batch held back from another night). */
export const beatsAcceptedNow = (input: QuietHourBeatsInput, nowMs: number): boolean => isQuietHourNow(nowMs) && input.day === vietnamDay(nowMs);

/** How many of `requested` strokes still fit for a person who has added `already` tonight. */
export const acceptedStrokes = (already: number, requested: number, cap: number = QUIET_HOUR_PERSON_CAP): number =>
  Math.max(0, Math.min(requested, cap - already));
