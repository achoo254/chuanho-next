/**
 * The device's progress (game/player-progress.ts) and the server's `ProgressDoc` hold the same fields; these turn
 * one into the other and fold a server answer into what the device has now. Pure.
 */
import { type ProgressDoc, mergeProgress, sameProgress } from '@chuanho/contract';
import type { PlayerProgress } from '../game/player-progress';

export function toProgressDoc(progress: PlayerProgress): ProgressDoc {
  const { merit, lastRewardedDay, peacefulDays, bestCombo, restraintCount, moSkin, ambientSounds, updatedAt } = progress;
  return { merit, lastRewardedDay, peacefulDays, bestCombo, restraintCount, moSkin, ambientSounds, updatedAt };
}

export function fromProgressDoc(doc: ProgressDoc): PlayerProgress {
  return toProgressDoc(doc);
}

/** Same values and the same preference stamp. */
export const sameProgressDoc = (a: ProgressDoc, b: ProgressDoc): boolean => sameProgress(a, b) && a.updatedAt === b.updatedAt;

/**
 * The server's merged progress folded into the device's current one (which may have moved on while the request was
 * out): counters take the larger, preferences the newer stamp. Answers `local` itself when nothing changes, so the
 * caller can skip a save and a render.
 */
export function adoptServerProgress(local: PlayerProgress, server: ProgressDoc): PlayerProgress {
  const merged = mergeProgress(toProgressDoc(local), server);
  return sameProgressDoc(merged, toProgressDoc(local)) ? local : fromProgressDoc(merged);
}
