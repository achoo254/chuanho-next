/**
 * "Giờ Tĩnh 22:30": a shared half hour every evening (Vietnam time) when everyone's mõ strokes add up to one national
 * count, and reaching a milestone unlocks a visual gift for all. The server only keeps a counter per day; players send
 * their strokes in small batches. REST: `GET /api/quiet-hour` (status, no sign-in needed) and
 * `POST /api/quiet-hour/beats` (signed in, QuietHourBeatsInput).
 */
import { isCount, isDayKey, isRecord } from './primitives';

/** Vietnam has no daylight saving time, so a fixed offset is right. */
export const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
export const QUIET_HOUR_START_MINUTE = 22 * 60 + 30;
export const QUIET_HOUR_LENGTH_MINUTES = 30;
/** Per person per night, so a script cannot fill the counter alone. */
export const QUIET_HOUR_PERSON_CAP = 400;
/** One batch carries at most this many strokes (a player cannot strike faster than this in the few seconds between batches). */
export const QUIET_HOUR_BATCH_MAX = 80;
export const QUIET_HOUR_MILESTONES = [1000, 5000, 20000, 100000] as const;

/** The Vietnam calendar day (`YYYY-MM-DD`) that contains `epochMs`. */
export const vietnamDay = (epochMs: number): string => new Date(epochMs + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);

/** Start and end (epoch ms) of the quiet hour that begins on the Vietnam day `day`. */
export function quietHourWindow(day: string): { start: number; end: number } {
  const midnight = Date.parse(`${day}T00:00:00Z`) - VIETNAM_OFFSET_MS;
  const start = midnight + QUIET_HOUR_START_MINUTE * 60_000;
  return { start, end: start + QUIET_HOUR_LENGTH_MINUTES * 60_000 };
}

export function isQuietHourNow(now: number): boolean {
  const { start, end } = quietHourWindow(vietnamDay(now));
  return now >= start && now < end;
}

/** Milliseconds until the next quiet hour begins (0 while one is on). */
export function msUntilQuietHour(now: number): number {
  const today = quietHourWindow(vietnamDay(now));
  if (now < today.end) return Math.max(0, today.start - now);
  return quietHourWindow(vietnamDay(now + 86_400_000)).start - now;
}

export const milestonesReached = (total: number): number[] => QUIET_HOUR_MILESTONES.filter((mark) => total >= mark);

export interface QuietHourStatus {
  readonly day: string;
  readonly open: boolean;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly total: number;
  readonly milestones: readonly number[];
  readonly serverNow: number;
}

export interface QuietHourBeatsInput {
  readonly day: string;
  readonly count: number;
}

export function parseQuietHourBeatsInput(raw: unknown): QuietHourBeatsInput | null {
  if (!isRecord(raw) || !isDayKey(raw.day) || !isCount(raw.count, QUIET_HOUR_BATCH_MAX) || raw.count === 0) return null;
  return { day: raw.day, count: raw.count };
}
