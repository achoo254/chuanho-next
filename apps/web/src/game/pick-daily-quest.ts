/**
 * The quest of a local day: consecutive days walk through the list in order, so nobody sees the same line two days
 * running and everyone gets the same line on the same day.
 */
import { isDayKey } from './session-day';

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 of a `YYYY-MM-DD` key (calendar arithmetic, no time zone involved). */
export function dayNumber(dayKey: string): number {
  if (!isDayKey(dayKey)) return 0;
  const [year, month, day] = dayKey.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

/** Index into a list of `count` quests for `dayKey`; always within 0..count-1 (0 for an empty list). */
export function dailyQuestIndex(dayKey: string, count: number): number {
  if (count <= 0) return 0;
  const n = dayNumber(dayKey);
  return ((n % count) + count) % count;
}

/** The quest for `dayKey`, or undefined when the list is empty. */
export function pickDailyQuest(dayKey: string, quests: readonly string[]): string | undefined {
  return quests[dailyQuestIndex(dayKey, quests.length)];
}
