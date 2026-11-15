/**
 * How the three incense sticks in the 3D censer look during the room's moments, as pure functions of time: the entry
 * cutscene (the character reaches the censer, the sticks rise and light with a burn sweep), the "light my stick"
 * cutscene, the live link to the player's real stick, and the flame reacting to the wind in "Hộ hương". The caller
 * hands the look to the stage with `applyIncenseLook`. The flame dims through the ember level, never through the burn,
 * so a flicker or a stick catching fire never makes the stick jump in length.
 */
import { stickState } from '@chuanho/contract';
import type { PlayStage } from '../../modes/play-stage';

export interface IncenseLook {
  /** 0 = fresh, 1 = burnt through; null puts the sticks away. A burn of exactly 0 shows them unlit. */
  readonly burn: number | null;
  /** Pouring smoke (otherwise a lit stick keeps a thin wisp). */
  readonly smoking: boolean;
  /** How bright the ember glows, 0 (dark, no smoke) to 1 (full); the stick's length does not change with it. */
  readonly ember: number;
}

/** The part of the stage that draws the sticks. */
export type IncenseStage = Pick<PlayStage, 'setIncense' | 'setIncenseEmber'>;

/** Draws a look on the stage. */
export function applyIncenseLook(stage: IncenseStage, look: IncenseLook): void {
  stage.setIncense(look.burn, look.smoking);
  stage.setIncenseEmber(look.ember);
}

/** The sticks put away (the ember back to full for whoever shows them next). */
export const PUT_AWAY: IncenseLook = { burn: null, smoking: false, ember: 1 };

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

/** The burn of a lit stick at `progress`, never below the smallest that shows an ember. */
const litBurn = (progress: number): number => Math.max(MIN_LIT_BURN, Math.min(1, progress));

/** The intro plays in full the first time in an app session; later (or with reduced motion) only briefly. */
export function introDurationMs(firstTime: boolean, reducedMotion: boolean): number {
  return firstTime && !reducedMotion ? INTRO_FULL_MS : INTRO_SHORT_MS;
}

/** When the sticks light during an intro of `durationMs` (the bell and the happy face go with it). */
export const introIgniteAtMs = (durationMs: number): number => Math.round(durationMs * INTRO_IGNITE_SHARE);

export function introLook(elapsedMs: number, durationMs: number, reducedMotion: boolean): IncenseLook {
  const igniteAt = introIgniteAtMs(durationMs);
  if (elapsedMs < igniteAt) return { burn: 0, smoking: false, ember: 0 };
  if (reducedMotion) return { burn: GREETING_BURN, smoking: true, ember: 1 };
  const sweepEnd = durationMs * INTRO_SWEEP_END_SHARE;
  const t = Math.min(1, (elapsedMs - igniteAt) / Math.max(1, sweepEnd - igniteAt));
  // Ease out: the flame catches fast, then settles.
  const eased = 1 - (1 - t) * (1 - t);
  return { burn: Math.max(MIN_LIT_BURN, GREETING_BURN * eased), smoking: true, ember: 1 };
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

/** Share of the burn over which the ember fades as the stick nears its end. */
export const BURN_OUT_FADE_SHARE = 0.03;
/** The faintest glow of a stick about to go out (it is put away once burnt through). */
export const BURN_OUT_MIN_EMBER = 0.15;

/** The ember of a stick at `progress`: full, then fading over the last stretch so it goes out gently. */
const burningEmber = (progress: number): number => Math.max(BURN_OUT_MIN_EMBER, Math.min(1, (1 - progress) / BURN_OUT_FADE_SHARE));

/**
 * Outside a room the greeting offering keeps a thin wisp; in a room the sticks wait unlit until the player lights
 * theirs, burn with its real progress (the ember fading over the last stretch), and are put away once it has burnt out.
 */
export function liveLook(status: MyStickStatus): IncenseLook {
  switch (status.kind) {
    case 'outside':
      return { burn: GREETING_BURN, smoking: false, ember: 1 };
    case 'unlit':
      return { burn: 0, smoking: false, ember: 0 };
    case 'burning':
      return { burn: litBurn(status.progress), smoking: true, ember: burningEmber(status.progress) };
    case 'burnt':
      return PUT_AWAY;
  }
}

export const LIGHT_UP_IGNITE_MS = 500;
export const LIGHT_UP_MS = 2_200;
/** How long the ember takes to catch to its full glow after the ignite beat. */
export const LIGHT_UP_CATCH_MS = 300;
/** The ember the instant it catches. */
const LIGHT_UP_FIRST_EMBER = 0.2;

/**
 * "Light my stick": the sticks stand dark a beat at their real length, then the ember catches (bell, +1) and smoke
 * pours; then the live look returns. Only the ember changes, so the stick never jumps in length.
 */
export function lightUpLook(elapsedMs: number, progress: number): IncenseLook {
  const burn = litBurn(progress);
  if (elapsedMs < LIGHT_UP_IGNITE_MS) return { burn, smoking: false, ember: 0 };
  const caught = Math.min(1, (elapsedMs - LIGHT_UP_IGNITE_MS) / LIGHT_UP_CATCH_MS);
  return { burn, smoking: true, ember: Math.max(LIGHT_UP_FIRST_EMBER, caught) };
}

/** How long the flame reacts to a shield or a gust that got through. */
export const FLAME_REACTION_MS = 600;
const FLICKER_STEP_MS = 120;
/** The ember on a flicker's dark beat: dimmed, not gone. */
export const FLICKER_EMBER = 0.15;
/** The ember of a low flame (two points or fewer). */
export const LOW_FLAME_EMBER = 0.6;

export type FlameReaction = 'none' | 'shielded' | 'gusted';

/**
 * The flame in "Hộ hương": a perfect shield makes it flare (smoke pours); a gust that gets through makes the ember
 * flicker dim and back; a low flame (two points or fewer) glows weaker and only keeps a thin wisp. The burn (the
 * stick's length) stays put throughout.
 */
export function gameLook(baseBurn: number, flame: number, reaction: FlameReaction, sinceReactionMs: number): IncenseLook {
  const burn = litBurn(baseBurn);
  const steady = flame <= 2 ? LOW_FLAME_EMBER : 1;
  const reacting = sinceReactionMs >= 0 && sinceReactionMs < FLAME_REACTION_MS;
  if (reacting && reaction === 'gusted') {
    const dark = Math.floor(sinceReactionMs / FLICKER_STEP_MS) % 2 === 0;
    return { burn, smoking: false, ember: dark ? FLICKER_EMBER : steady };
  }
  if (reacting && reaction === 'shielded') return { burn, smoking: true, ember: 1 };
  return { burn, smoking: flame > 2, ember: steady };
}
