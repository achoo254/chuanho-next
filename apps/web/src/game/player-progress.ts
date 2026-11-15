/**
 * The guest's progress, kept on this device: merit (one rewarded full session a day), peaceful days (shown off,
 * never punished when a day is skipped), the best combo, and a few preferences. Merit only dresses up the yard.
 */
import { MO_SKIN_IDS, type MoSkinId, isEpochMs } from '@chuanho/contract';
import { readStored, writeStored } from './safe-storage';
import { isDayKey, isNewFullSessionDay } from './session-day';

const STORAGE_KEY = 'chuanho.progress.v1';
export const MERIT_PER_FULL_SESSION = 10;

export type { MoSkinId };

/** Art and unlock merit per skin. Keyed by the contract's ids, so the web and server lists cannot drift apart. */
const SKIN_DETAILS: Readonly<Record<MoSkinId, { readonly src: string; readonly merit: number }>> = {
  red: { src: '/art/mo.webp', merit: 0 },
  carved: { src: '/art/mo-alt.webp', merit: 20 },
  fish: { src: '/art/mo-fish.webp', merit: 40 },
};

export const MO_SKINS: readonly { readonly id: MoSkinId; readonly src: string; readonly merit: number }[] = MO_SKIN_IDS.map((id) => ({
  id,
  ...SKIN_DETAILS[id],
}));

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
  /** Times the player chose to hold back a harsh word: a positive stat only, never a debt or a streak. */
  readonly restraintCount: number;
  readonly moSkin: MoSkinId;
  /** Bell and singing bowl cues (the wooden bell itself always sounds). */
  readonly ambientSounds: boolean;
  /** When a preference (skin, sounds) last changed (epoch ms), so account sync knows which device's choice wins. */
  readonly updatedAt: number;
}

export const DEFAULT_PROGRESS: PlayerProgress = {
  merit: 0,
  lastRewardedDay: null,
  peacefulDays: 0,
  bestCombo: 0,
  restraintCount: 0,
  moSkin: 'red',
  ambientSounds: true,
  // The contract's floor value: a device that never touched its preferences loses to one that did.
  updatedAt: 1,
};

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isSkin = (value: unknown): value is MoSkinId => MO_SKIN_IDS.some((id) => id === value);

/** Validates stored progress field by field; a bad field falls back to its default instead of losing the rest. */
export function parseProgress(raw: unknown): PlayerProgress | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return {
    merit: isCount(r.merit) ? r.merit : DEFAULT_PROGRESS.merit,
    lastRewardedDay: isDayKey(r.lastRewardedDay) ? r.lastRewardedDay : null,
    peacefulDays: isCount(r.peacefulDays) ? r.peacefulDays : DEFAULT_PROGRESS.peacefulDays,
    bestCombo: isCount(r.bestCombo) ? r.bestCombo : DEFAULT_PROGRESS.bestCombo,
    restraintCount: isCount(r.restraintCount) ? r.restraintCount : DEFAULT_PROGRESS.restraintCount,
    moSkin: isSkin(r.moSkin) ? r.moSkin : DEFAULT_PROGRESS.moSkin,
    ambientSounds: typeof r.ambientSounds === 'boolean' ? r.ambientSounds : DEFAULT_PROGRESS.ambientSounds,
    updatedAt: isEpochMs(r.updatedAt) ? r.updatedAt : DEFAULT_PROGRESS.updatedAt,
  };
}

export function loadProgress(): PlayerProgress {
  return readStored(STORAGE_KEY, parseProgress) ?? DEFAULT_PROGRESS;
}

export function saveProgress(progress: PlayerProgress): void {
  writeStored(STORAGE_KEY, progress);
}

/** Moves `updatedAt` to `now` when a preference changed between `before` and `after`; counters alone never do. */
export function stampPreferences(before: PlayerProgress, after: PlayerProgress, now: number): PlayerProgress {
  const changed = before.moSkin !== after.moSkin || before.ambientSounds !== after.ambientSounds;
  return changed ? { ...after, updatedAt: Math.max(now, before.updatedAt + 1) } : after;
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

/** The player held back a harsh word once more. */
export function addRestraint(progress: PlayerProgress): PlayerProgress {
  return { ...progress, restraintCount: progress.restraintCount + 1 };
}

export function isUnlocked(item: { readonly merit: number }, progress: PlayerProgress): boolean {
  return progress.merit >= item.merit;
}
