/**
 * The device's fortune state in localStorage (`chuanho.fortune.v1`): a random seed made on the first draw, and the
 * day and index of the last draw. Unreadable storage just means a fresh seed; a refused write only means the next
 * visit draws again from the same rules (the quẻ of the day is the same as long as the seed survives).
 */
import { readStored, writeStored } from '../../game/safe-storage';
import { localDateKey } from '../../game/session-day';
import { newEntryId } from '../journal/journal-logic';
import { type FortuneDraw, type FortuneState, drawFortune, parseFortuneState } from './fortune-pick';

export const FORTUNE_STORAGE_KEY = 'chuanho.fortune.v1';

export function readFortuneState(): FortuneState | null {
  return readStored(FORTUNE_STORAGE_KEY, parseFortuneState);
}

/** Draws today's quẻ for this device and keeps the result. */
export function drawAndKeep(count: number, now: Date = new Date()): FortuneDraw {
  const draw = drawFortune(readFortuneState(), localDateKey(now), count, () => newEntryId());
  if (!draw.again) writeStored(FORTUNE_STORAGE_KEY, draw.state);
  return draw;
}
