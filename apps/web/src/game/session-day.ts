/**
 * Calendar days in the player's own time zone, and the "one rewarded session a day" rule. A day is a `YYYY-MM-DD`
 * key, which sorts like the dates it names.
 */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The local calendar day of `date` as `YYYY-MM-DD`. */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && DAY_KEY.test(value);
}

/**
 * Whether a full session finished on `today` earns the daily reward: true when no rewarded day is stored (or the
 * stored one is unreadable) and when `today` comes after it. The same day again, or a clock set back, earns nothing.
 */
export function isNewFullSessionDay(lastDate: string | null | undefined, today: string): boolean {
  if (!isDayKey(today)) return false;
  if (!isDayKey(lastDate)) return true;
  return today > lastDate;
}
