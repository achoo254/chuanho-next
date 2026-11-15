/** Small checks shared by every contract file: ids, day keys, bounded text and counters. Pure, no dependencies. */

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A local calendar day as `YYYY-MM-DD` (the player's own day, so no time zone is stored). */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** An id the client makes itself (so offline work can be merged later): lowercase letters, digits and dashes. */
export const isRecordId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9-]{8,40}$/.test(value);

export const isCount = (value: unknown, max = 1_000_000_000): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

export const isEpochMs = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 8.64e15;

/** Text up to `max` characters after trimming (blank is allowed unless `min` says otherwise). */
export function cleanText(value: unknown, max: number, min = 0): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}
