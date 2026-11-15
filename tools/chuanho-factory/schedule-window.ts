/**
 * The daily time window the factory may use the GPU in, local time. A window may wrap midnight (23:00-07:00).
 */

export interface DailyWindow {
  /** Minutes after local midnight. */
  readonly startMinute: number;
  readonly endMinute: number;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(text: string): number {
  const match = HHMM.exec(text.trim());
  if (!match) throw new Error(`window time "${text}" must be HH:MM`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "23:00-07:00" -> window; equal start and end means always open. */
export function parseWindow(text: string): DailyWindow {
  const [start, end, ...rest] = text.split('-');
  if (start === undefined || end === undefined || rest.length > 0) throw new Error(`window "${text}" must look like 23:00-07:00`);
  return { startMinute: minutes(start), endMinute: minutes(end) };
}

export function formatWindow(window: DailyWindow): string {
  const hhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${hhmm(window.startMinute)}-${hhmm(window.endMinute)}`;
}

function minuteOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function isInsideWindow(window: DailyWindow, now: Date): boolean {
  const { startMinute: start, endMinute: end } = window;
  if (start === end) return true;
  const m = minuteOfDay(now);
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/** Milliseconds until the window next opens; 0 when it is open now. Uses local wall-clock time (DST-safe). */
export function msUntilWindowOpens(window: DailyWindow, now: Date): number {
  if (isInsideWindow(window, now)) return 0;
  const next = new Date(now);
  next.setHours(Math.floor(window.startMinute / 60), window.startMinute % 60, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
