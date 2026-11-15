/**
 * The wind of one "Hộ hương" round: 12 to 16 gusts from the left or the right, 1.8 to 3.2 s apart, all inside a
 * 40-second round. Seeded from the day and the room code, so everyone in a room faces the same wind today and a new
 * pattern tomorrow. Pure; the overlay draws each gust's warning `TELEGRAPH_MS` before it lands.
 */
import { seededRandom } from '../../autonomy/seeded-random';

export type GustSide = 'left' | 'right';

export interface Gust {
  readonly side: GustSide;
  /** When the gust reaches the censer, in ms since the round started. */
  readonly atMs: number;
}

export const ROUND_MS = 40_000;
export const MIN_GUSTS = 12;
export const MAX_GUSTS = 16;
export const MIN_SPACING_MS = 1_800;
export const MAX_SPACING_MS = 3_200;
/** The first gust lands after a calm start (its warning shows a little before). */
export const FIRST_GUST_MS = 2_500;
/** The last gust lands at least this long before the round's end, so its result is seen. */
const END_CALM_MS = 1_500;
/** How long a gust's warning shows before it lands. */
export const TELEGRAPH_MS = 900;
/** Never more than this many gusts in a row from the same side. */
const MAX_SAME_SIDE = 3;

/** A 32-bit seed from the local day (`YYYY-MM-DD`) and the room code (FNV-1a), the same on every device. */
export function gustSeed(dayKey: string, roomCode: string): number {
  let hash = 0x811c9dc5;
  for (const char of `${dayKey}|${roomCode.toUpperCase()}`) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The gusts of the round for `seed`, in time order. */
export function buildGustSchedule(seed: number): readonly Gust[] {
  const random = seededRandom(seed);
  const count = MIN_GUSTS + Math.floor(random() * (MAX_GUSTS - MIN_GUSTS + 1));
  const raw = Array.from({ length: count - 1 }, () => MIN_SPACING_MS + random() * (MAX_SPACING_MS - MIN_SPACING_MS));
  // Squeeze the gaps toward the minimum when they would run past the round (16 gusts at long gaps do not fit).
  const span = ROUND_MS - END_CALM_MS - FIRST_GUST_MS;
  const floor = MIN_SPACING_MS * raw.length;
  const total = raw.reduce((sum, gap) => sum + gap, 0);
  const squeeze = total > span ? (span - floor) / (total - floor) : 1;
  const gaps = raw.map((gap) => MIN_SPACING_MS + (gap - MIN_SPACING_MS) * squeeze);

  const gusts: Gust[] = [];
  let at = FIRST_GUST_MS;
  let run = 0;
  let previous: GustSide | null = null;
  for (let index = 0; index < count; index += 1) {
    let side: GustSide = random() < 0.5 ? 'left' : 'right';
    if (side === previous && run >= MAX_SAME_SIDE) side = side === 'left' ? 'right' : 'left';
    run = side === previous ? run + 1 : 1;
    previous = side;
    gusts.push({ side, atMs: Math.round(at) });
    at += gaps[index] ?? 0;
  }
  return gusts;
}
