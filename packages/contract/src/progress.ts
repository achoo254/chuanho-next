/** The player's progress as stored on the server. Counters only ever grow, so two devices merge by taking the larger. */
import { isCount, isDayKey, isEpochMs, isRecord } from './primitives';

export const MO_SKIN_IDS = ['red', 'carved', 'fish'] as const;
export type MoSkinId = (typeof MO_SKIN_IDS)[number];

export interface ProgressDoc {
  readonly merit: number;
  readonly lastRewardedDay: string | null;
  readonly peacefulDays: number;
  readonly bestCombo: number;
  /** Times the player chose to hold back a harsh word (shown as a positive stat, never as a debt). */
  readonly restraintCount: number;
  readonly moSkin: MoSkinId;
  readonly ambientSounds: boolean;
  /** When the preferences (skin, sounds) last changed, to settle which device's choice wins. */
  readonly updatedAt: number;
}

export const EMPTY_PROGRESS: ProgressDoc = {
  merit: 0,
  lastRewardedDay: null,
  peacefulDays: 0,
  bestCombo: 0,
  restraintCount: 0,
  moSkin: 'red',
  ambientSounds: true,
  updatedAt: 1,
};

export const isMoSkinId = (value: unknown): value is MoSkinId => (MO_SKIN_IDS as readonly unknown[]).includes(value);

/** Field by field: a bad field falls back to its default instead of dropping the whole document. */
export function parseProgressDoc(raw: unknown): ProgressDoc | null {
  if (!isRecord(raw)) return null;
  return {
    merit: isCount(raw.merit) ? raw.merit : 0,
    lastRewardedDay: isDayKey(raw.lastRewardedDay) ? raw.lastRewardedDay : null,
    peacefulDays: isCount(raw.peacefulDays) ? raw.peacefulDays : 0,
    bestCombo: isCount(raw.bestCombo) ? raw.bestCombo : 0,
    restraintCount: isCount(raw.restraintCount) ? raw.restraintCount : 0,
    moSkin: isMoSkinId(raw.moSkin) ? raw.moSkin : 'red',
    ambientSounds: typeof raw.ambientSounds === 'boolean' ? raw.ambientSounds : true,
    updatedAt: isEpochMs(raw.updatedAt) ? raw.updatedAt : 1,
  };
}

/** Counters take the larger value, the latest rewarded day wins, preferences follow the newer `updatedAt`. */
export function mergeProgress(a: ProgressDoc, b: ProgressDoc): ProgressDoc {
  const newer = b.updatedAt >= a.updatedAt ? b : a;
  const days = [a.lastRewardedDay, b.lastRewardedDay].filter((day): day is string => day !== null).sort();
  return {
    merit: Math.max(a.merit, b.merit),
    lastRewardedDay: days.at(-1) ?? null,
    peacefulDays: Math.max(a.peacefulDays, b.peacefulDays),
    bestCombo: Math.max(a.bestCombo, b.bestCombo),
    restraintCount: Math.max(a.restraintCount, b.restraintCount),
    moSkin: newer.moSkin,
    ambientSounds: newer.ambientSounds,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** Same stored values, ignoring `updatedAt` (used to skip a sync when nothing changed). */
export const sameProgress = (a: ProgressDoc, b: ProgressDoc): boolean =>
  a.merit === b.merit &&
  a.lastRewardedDay === b.lastRewardedDay &&
  a.peacefulDays === b.peacefulDays &&
  a.bestCombo === b.bestCombo &&
  a.restraintCount === b.restraintCount &&
  a.moSkin === b.moSkin &&
  a.ambientSounds === b.ambientSounds;
