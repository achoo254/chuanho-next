/**
 * "Giờ Tĩnh" timing on the web, pure: the server's clock (learned from `serverNow`, so a phone set five minutes off
 * still counts down to the real 22:30), what the HUD chip shows at a moment, and when to ask the server again.
 * Windows and day keys come from the contract's helpers, the same ones the server uses.
 */
import {
  QUIET_HOUR_START_MINUTE,
  type QuietHourStatus,
  isQuietHourNow,
  milestonesReached,
  msUntilQuietHour,
  quietHourWindow,
  vietnamDay,
} from '@chuanho/contract';

/** The chip appears this long before the half hour starts. */
export const LEAD_MS = 60 * 60_000;
export const POLL_OPEN_MS = 30_000;
export const POLL_IDLE_MS = 5 * 60_000;

/** How far the server's clock is ahead of this device's (negative when behind). */
export const serverOffset = (serverNow: number, receivedAt: number): number => serverNow - receivedAt;

/** "22:30", from the contract's start minute (Vietnam time, which is what the player reads too). */
export const QUIET_HOUR_START_LABEL = `${String(Math.floor(QUIET_HOUR_START_MINUTE / 60)).padStart(2, '0')}:${String(QUIET_HOUR_START_MINUTE % 60).padStart(2, '0')}`;

export type QuietHourView =
  | { readonly phase: 'hidden' }
  /** Starting soon: whole minutes until it starts (at least 1). */
  | { readonly phase: 'before'; readonly minutes: number }
  /** On now: whole minutes left, tonight's shared total and the milestones reached. */
  | { readonly phase: 'open'; readonly minutes: number; readonly total: number; readonly milestones: readonly number[] }
  /** Over for tonight (until Vietnam midnight): the final total and milestones. */
  | { readonly phase: 'after'; readonly total: number; readonly milestones: readonly number[] };

const HIDDEN: QuietHourView = { phase: 'hidden' };
const wholeMinutes = (ms: number): number => Math.max(1, Math.ceil(ms / 60_000));

/** What the chip shows at server time `now`, given the last status (null when the server never answered). */
export function quietHourView(status: QuietHourStatus | null, now: number): QuietHourView {
  if (!status) return HIDDEN;
  const today = vietnamDay(now);
  // The total belongs to tonight only; a status from yesterday (a long-asleep tab) shows no number.
  const total = status.day === today ? status.total : 0;
  if (isQuietHourNow(now)) {
    return { phase: 'open', minutes: wholeMinutes(quietHourWindow(today).end - now), total, milestones: milestonesReached(total) };
  }
  const until = msUntilQuietHour(now);
  if (until <= LEAD_MS) return { phase: 'before', minutes: wholeMinutes(until) };
  if (total > 0 && now >= quietHourWindow(today).end) return { phase: 'after', total, milestones: milestonesReached(total) };
  return HIDDEN;
}

/** When to ask for the status again: every 30 s while it is on, otherwise every 5 minutes or right as it opens. */
export function nextPollDelay(now: number): number {
  if (isQuietHourNow(now)) return POLL_OPEN_MS;
  return Math.min(POLL_IDLE_MS, msUntilQuietHour(now) + 1_000);
}
