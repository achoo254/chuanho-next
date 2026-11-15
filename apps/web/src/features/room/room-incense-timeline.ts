/**
 * How the three incense sticks in the 3D censer look during the room's moments, as pure functions of time: the entry
 * cutscene (the character reaches the censer, the sticks rise and light with a burn sweep), the "light my stick"
 * cutscene, the live link to the player's real stick, and the flame reacting to the wind in "Hộ hương". The caller
 * hands the look to `stage.setIncense(burn, smoking)`.
 */
import { stickState } from '@chuanho/contract';

export interface IncenseLook {
  /** 0 = fresh, 1 = burnt through; null puts the sticks away. A burn of exactly 0 shows them unlit. */
  readonly burn: number | null;
  /** Pouring smoke (otherwise a lit stick keeps a thin wisp). */
  readonly smoking: boolean;
}

export const INTRO_FULL_MS = 2_500;
export const INTRO_SHORT_MS = 800;
/** Share of the intro spent walking before the sticks light (bell, happy face). */
const INTRO_IGNITE_SHARE = 0.4;
/** Share of the intro at which the burn sweep is done. */
const INTRO_SWEEP_END_SHARE = 0.85;
/** The character's greeting offering: lit a little, before the room knows the player's own stick. */
export const GREETING_BURN = 0.12;
/** A just-lit stick still shows its ember. */
const MIN_LIT_BURN = 0.02;

/** The intro plays in full the first time in an app session; later (or with reduced motion) only briefly. */
export function introDurationMs(firstTime: boolean, reducedMotion: boolean): number {
  return firstTime && !reducedMotion ? INTRO_FULL_MS : INTRO_SHORT_MS;
}

/** When the sticks light during an intro of `durationMs` (the bell and the happy face go with it). */
export const introIgniteAtMs = (durationMs: number): number => Math.round(durationMs * INTRO_IGNITE_SHARE);

export function introLook(elapsedMs: number, durationMs: number, reducedMotion: boolean): IncenseLook {
  const igniteAt = introIgniteAtMs(durationMs);
  if (elapsedMs < igniteAt) return { burn: 0, smoking: false };
  if (reducedMotion) return { burn: GREETING_BURN, smoking: true };
  const sweepEnd = durationMs * INTRO_SWEEP_END_SHARE;
  const t = Math.min(1, (elapsedMs - igniteAt) / Math.max(1, sweepEnd - igniteAt));
  // Ease out: the flame catches fast, then settles.
  const eased = 1 - (1 - t) * (1 - t);
  return { burn: Math.max(MIN_LIT_BURN, GREETING_BURN * eased), smoking: true };
}

/** The player's own stick as the 3D censer shows it outside cutscenes and the minigame. */
export type MyStickStatus =
  | { readonly kind: 'outside' }
  | { readonly kind: 'unlit' }
  | { readonly kind: 'burning'; readonly progress: number }
  | { readonly kind: 'burnt' };

/** What the room screen knows about the player's own stick. */
export interface MyStickSource {
  readonly inRoom: boolean;
  readonly stick: { readonly litAt: number; readonly burnsOutAt: number } | null;
  /** Server clock minus device clock. */
  readonly offset: number;
}

export const OUTSIDE_ROOM: MyStickSource = { inRoom: false, stick: null, offset: 0 };

/** Where the player's stick stands at device time `deviceNow`, on the server's clock. */
export function myStickStatus(source: MyStickSource, deviceNow: number): MyStickStatus {
  if (!source.inRoom) return { kind: 'outside' };
  if (!source.stick) return { kind: 'unlit' };
  const state = stickState(source.stick, deviceNow + source.offset);
  return state.burntOut ? { kind: 'burnt' } : { kind: 'burning', progress: state.progress };
}

/**
 * Outside a room the greeting offering keeps a thin wisp; in a room the sticks wait unlit until the player lights
 * theirs, burn with its real progress, and are put away once it has burnt out.
 */
export function liveLook(status: MyStickStatus): IncenseLook {
  switch (status.kind) {
    case 'outside':
      return { burn: GREETING_BURN, smoking: false };
    case 'unlit':
      return { burn: 0, smoking: false };
    case 'burning':
      return { burn: Math.max(MIN_LIT_BURN, Math.min(1, status.progress)), smoking: true };
    case 'burnt':
      return { burn: null, smoking: false };
  }
}

export const LIGHT_UP_IGNITE_MS = 500;
export const LIGHT_UP_MS = 2_200;

/** "Light my stick": the sticks stand unlit a beat, then catch (bell, +1) and pour smoke; then the live look returns. */
export function lightUpLook(elapsedMs: number, progress: number): IncenseLook {
  if (elapsedMs < LIGHT_UP_IGNITE_MS) return { burn: 0, smoking: false };
  return { burn: Math.max(MIN_LIT_BURN, Math.min(1, progress)), smoking: true };
}

/** How long the flame reacts to a shield or a gust that got through. */
export const FLAME_REACTION_MS = 600;
const FLICKER_STEP_MS = 120;

export type FlameReaction = 'none' | 'shielded' | 'gusted';

/**
 * The flame in "Hộ hương": a perfect shield makes it flare (smoke pours); a gust that gets through makes the ember
 * flicker out and back; a low flame (two points or fewer) only keeps a thin wisp.
 */
export function gameLook(baseBurn: number, flame: number, reaction: FlameReaction, sinceReactionMs: number): IncenseLook {
  const burn = Math.max(MIN_LIT_BURN, Math.min(1, baseBurn));
  const reacting = sinceReactionMs >= 0 && sinceReactionMs < FLAME_REACTION_MS;
  if (reacting && reaction === 'gusted') {
    const out = Math.floor(sinceReactionMs / FLICKER_STEP_MS) % 2 === 0;
    return { burn: out ? 0 : burn, smoking: false };
  }
  if (reacting && reaction === 'shielded') return { burn, smoking: true };
  return { burn, smoking: flame > 2 };
}
