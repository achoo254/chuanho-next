/**
 * Which quẻ falls out of the tube on a day, on this device. Pure and deterministic: the same (device seed, local day)
 * always gives the same quẻ, so drawing again the same day only shows it again, and the next day brings another.
 *
 * Days are cut into blocks of `count` (the deck size); each block is a shuffle of the deck seeded by the device and
 * the block, so every quẻ comes once per block, and the first day of a block never repeats the last day of the block
 * before. Nothing calls a model or a server; the only stored thing is the device seed and the last draw.
 */
import { isRecord } from '@chuanho/contract';
import { isDayKey } from '../../game/session-day';

const DAY_MS = 24 * 3600 * 1000;

/** 32-bit FNV-1a of a string's UTF-16 code units. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** mulberry32: a small seeded generator of numbers in [0, 1). */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The deck order of one block for one device (Fisher–Yates). */
function blockOrder(seed: string, block: number, count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const random = generator(fnv1a(`${seed}|${block}`));
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = order[i] ?? i;
    order[i] = order[j] ?? j;
    order[j] = swap;
  }
  return order;
}

/** Day number since 1970-01-01 of a `YYYY-MM-DD` day. */
export function dayNumber(day: string): number {
  const time = isDayKey(day) ? Date.parse(`${day}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(time)) throw new RangeError(`not a day: ${day}`);
  return Math.round(time / DAY_MS);
}

/** Index in a deck of `count` quẻ for the device `seed` on the local day `day` (`YYYY-MM-DD`). */
export function queIndex(seed: string, day: string, count: number): number {
  if (!Number.isInteger(count) || count < 2) throw new RangeError('a deck needs at least two quẻ');
  const n = dayNumber(day);
  const block = Math.floor(n / count);
  const position = n - block * count;
  const order = blockOrder(seed, block, count);
  if (position <= 1) {
    // The block's first two days are swapped when its first quẻ is the last one of the block before.
    const previousLast = blockOrder(seed, block - 1, count)[count - 1];
    if (order[0] === previousLast) return order[1 - position] ?? 0;
  }
  return order[position] ?? 0;
}

/** What is kept in localStorage (`chuanho.fortune.v1`). */
export interface FortuneState {
  readonly seed: string;
  readonly lastDay: string | null;
  readonly lastIndex: number | null;
}

const SEED_SHAPE = /^[a-z0-9-]{4,64}$/i;

/** Stored JSON to a state; anything unreadable is null (a fresh seed is made). A broken last draw is just forgotten. */
export function parseFortuneState(raw: unknown): FortuneState | null {
  if (!isRecord(raw) || typeof raw.seed !== 'string' || !SEED_SHAPE.test(raw.seed)) return null;
  const { lastDay, lastIndex } = raw;
  if (isDayKey(lastDay) && typeof lastIndex === 'number' && Number.isInteger(lastIndex) && lastIndex >= 0) return { seed: raw.seed, lastDay, lastIndex };
  return { seed: raw.seed, lastDay: null, lastIndex: null };
}

/** Whether this device already drew a quẻ `today` that still exists in a deck of `count`. */
export function drewToday(state: FortuneState | null, today: string, count: number): boolean {
  return state !== null && state.lastDay === today && state.lastIndex !== null && state.lastIndex < count;
}

export interface FortuneDraw {
  readonly index: number;
  /** True when today's quẻ was already drawn: it is shown again, not drawn anew. */
  readonly again: boolean;
  readonly state: FortuneState;
}

/** One draw on `today`: today's earlier quẻ again, or the day's quẻ for this device (made with `newSeed` if none yet). */
export function drawFortune(state: FortuneState | null, today: string, count: number, newSeed: () => string): FortuneDraw {
  if (state && drewToday(state, today, count) && state.lastIndex !== null) return { index: state.lastIndex, again: true, state };
  const seed = state?.seed ?? newSeed();
  const index = queIndex(seed, today, count);
  return { index, again: false, state: { seed, lastDay: today, lastIndex: index } };
}
