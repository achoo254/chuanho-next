/**
 * The bank of Tiểu Đệ's lines (words in tieude-messages.ts under `line.<id>`) and the pure picker: lines for the
 * current part of the day come up more often, lines that mention merit only once there is some, and the line just
 * said never comes right back. Also the "not today" silence kept in localStorage (`chuanho.tieude.v1`).
 */
import { isRecord } from '@chuanho/contract';
import { isDayKey } from '../../game/session-day';
import type { TieuDeTextKey } from './tieude-messages';

export type DayPart = 'morning' | 'day' | 'evening' | 'night';

/** The local hour's part of the day: morning 5–10, evening 17–21, night 22–4, day otherwise. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 17 && hour < 22) return 'evening';
  if (hour >= 22 || hour < 5) return 'night';
  return 'day';
}

export interface TieuDeLine {
  readonly key: Extract<TieuDeTextKey, `line.${string}`>;
  /** Only said in this part of the day; any part when absent. */
  readonly part?: Exclude<DayPart, 'day'>;
  /** Mentions the merit count (`{merit}`), so only said when it is above zero. */
  readonly merit?: true;
}

export const TIEUDE_LINES: readonly TieuDeLine[] = [
  { key: 'line.water' },
  { key: 'line.water2' },
  { key: 'line.breath' },
  { key: 'line.jaw' },
  { key: 'line.shoulders' },
  { key: 'line.neck' },
  { key: 'line.eyes' },
  { key: 'line.mo' },
  { key: 'line.mo2' },
  { key: 'line.bell' },
  { key: 'line.incense' },
  { key: 'line.journal' },
  { key: 'line.journal2' },
  { key: 'line.radio' },
  { key: 'line.gentle' },
  { key: 'line.fortune' },
  { key: 'line.kind' },
  { key: 'line.slow' },
  { key: 'line.rest' },
  { key: 'line.posture' },
  { key: 'line.snack' },
  { key: 'line.sky' },
  { key: 'line.screen' },
  { key: 'line.gratitude' },
  { key: 'line.merit', merit: true },
  { key: 'line.merit2', merit: true },
  { key: 'line.merit3', merit: true },
  { key: 'line.morning', part: 'morning' },
  { key: 'line.morning2', part: 'morning' },
  { key: 'line.morning3', part: 'morning' },
  { key: 'line.evening', part: 'evening' },
  { key: 'line.evening2', part: 'evening' },
  { key: 'line.evening3', part: 'evening' },
  { key: 'line.night', part: 'night' },
  { key: 'line.night2', part: 'night' },
  { key: 'line.night3', part: 'night' },
];

/** How much more often a line of the current part of the day comes up than an everyday one. */
const PART_WEIGHT = 4;

export interface PickContext {
  /** Local hour, 0–23. */
  readonly hour: number;
  readonly merit: number;
  /** The line said last time, never said twice in a row. */
  readonly lastKey: TieuDeLine['key'] | null;
  /** A number in [0, 1). */
  readonly random: () => number;
}

/** The lines that may be said now (before weighting). */
export function eligibleLines(lines: readonly TieuDeLine[], context: Omit<PickContext, 'random'>): TieuDeLine[] {
  const part = dayPart(context.hour);
  return lines.filter((line) => line.key !== context.lastKey && (line.part === undefined || line.part === part) && (!line.merit || context.merit > 0));
}

/** One weighted pick among the eligible lines; null only for a bank with nothing sayable. */
export function pickTieuDeLine(lines: readonly TieuDeLine[], context: PickContext): TieuDeLine | null {
  const pool = eligibleLines(lines, context);
  const weight = (line: TieuDeLine): number => (line.part ? PART_WEIGHT : 1);
  const total = pool.reduce((sum, line) => sum + weight(line), 0);
  let target = context.random() * total;
  for (const line of pool) {
    target -= weight(line);
    if (target < 0) return line;
  }
  return pool.at(-1) ?? null;
}

/** Merit earned on `today`: a full session rewards it once a day, so it is that reward when today was rewarded, else 0. */
export function meritToday(lastRewardedDay: string | null, today: string, perSession: number): number {
  return lastRewardedDay === today ? perSession : 0;
}

/** What is kept in localStorage: the day the player asked for no more nudges. */
export const TIEUDE_STORAGE_KEY = 'chuanho.tieude.v1';

export interface TieuDeSilence {
  readonly silencedDay: string;
}

export function parseTieuDeSilence(raw: unknown): TieuDeSilence | null {
  return isRecord(raw) && isDayKey(raw.silencedDay) ? { silencedDay: raw.silencedDay } : null;
}

/** Silent for the rest of the day the player asked on; back the next day. */
export function isSilenced(silence: TieuDeSilence | null, today: string): boolean {
  return silence !== null && silence.silencedDay === today;
}
