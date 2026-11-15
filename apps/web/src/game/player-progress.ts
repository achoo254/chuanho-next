/**
 * The guest's progress, kept on this device: merit (one rewarded full session a day), peaceful days (shown off,
 * never punished when a day is skipped), the best combo, and a few preferences. Merit only dresses up the yard.
 */
import { readStored, writeStored } from './safe-storage';
import { isDayKey, isNewFullSessionDay } from './session-day';

const STORAGE_KEY = 'chuanho.progress.v1';
export const MERIT_PER_FULL_SESSION = 10;

export const MO_SKINS = [
  { id: 'red', src: '/art/mo.webp', merit: 0 },
  { id: 'carved', src: '/art/mo-alt.webp', merit: 20 },
  { id: 'fish', src: '/art/mo-fish.webp', merit: 40 },
] as const;
export type MoSkinId = (typeof MO_SKINS)[number]['id'];

/** Yard decorations, purely visual, appearing as merit grows. */
export const DECORATIONS = [
  { id: 'lanternLeft', merit: 10 },
  { id: 'lanternRight', merit: 20 },
  { id: 'lotus', merit: 30 },
  { id: 'bodhiSapling', merit: 50 },
] as const;
export type DecorationId = (typeof DECORATIONS)[number]['id'];

export interface PlayerProgress {
  readonly merit: number;
  /** The last local day a full session was rewarded (`YYYY-MM-DD`), or null. */
  readonly lastRewardedDay: string | null;
  readonly peacefulDays: number;
  readonly bestCombo: number;
  readonly moSkin: MoSkinId;
  /** Bell and singing bowl cues (the wooden bell itself always sounds). */
  readonly ambientSounds: boolean;
}

export const DEFAULT_PROGRESS: PlayerProgress = {
  merit: 0,
  lastRewardedDay: null,
  peacefulDays: 0,
  bestCombo: 0,
  moSkin: 'red',
  ambientSounds: true,
};

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isSkin = (value: unknown): value is MoSkinId => MO_SKINS.some((skin) => skin.id === value);

/** Validates stored progress field by field; a bad field falls back to its default instead of losing the rest. */
export function parseProgress(raw: unknown): PlayerProgress | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    merit: isCount(r.merit) ? r.merit : DEFAULT_PROGRESS.merit,
    lastRewardedDay: isDayKey(r.lastRewardedDay) ? r.lastRewardedDay : null,
    peacefulDays: isCount(r.peacefulDays) ? r.peacefulDays : DEFAULT_PROGRESS.peacefulDays,
    bestCombo: isCount(r.bestCombo) ? r.bestCombo : DEFAULT_PROGRESS.bestCombo,
    moSkin: isSkin(r.moSkin) ? r.moSkin : DEFAULT_PROGRESS.moSkin,
    ambientSounds: typeof r.ambientSounds === 'boolean' ? r.ambientSounds : DEFAULT_PROGRESS.ambientSounds,
  };
}

export function loadProgress(): PlayerProgress {
  return readStored(STORAGE_KEY, parseProgress) ?? DEFAULT_PROGRESS;
}

export function saveProgress(progress: PlayerProgress): void {
  writeStored(STORAGE_KEY, progress);
}

/** A full session finished on `today`: the first one of a day earns merit and a peaceful day; later ones earn nothing. */
export function completeFullSession(progress: PlayerProgress, today: string): { progress: PlayerProgress; rewarded: boolean } {
  if (!isNewFullSessionDay(progress.lastRewardedDay, today)) return { progress, rewarded: false };
  return {
    progress: {
      ...progress,
      merit: progress.merit + MERIT_PER_FULL_SESSION,
      lastRewardedDay: today,
      peacefulDays: progress.peacefulDays + 1,
    },
    rewarded: true,
  };
}

export function isUnlocked(item: { readonly merit: number }, progress: PlayerProgress): boolean {
  return progress.merit >= item.merit;
}
