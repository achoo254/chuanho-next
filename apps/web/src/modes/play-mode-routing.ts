/**
 * The world is the menu: what a picked prop, a corner icon or a number key leads to in the 3D game. Pure lookups so
 * the routing is tested apart from the scene: the censer opens incense, the sutra stand the chanting, the wooden fish
 * offers both drumming modes (a choice), bell and bowl just sound, the board offers the journal, the gentle-words tool and the radio (screens in features/).
 */
import { SESSION_STEPS, type SessionStep } from '../game/game-session-context';
import { type WorldAction, isComingSoon } from '../scene/world-actions';

export const PLAY_MODES = ['yard', 'incense', 'beat', 'sutra', 'endless', 'sessionEnd', 'share', 'journal', 'gentle', 'radio', 'fortune', 'room'] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

export type PickRoute =
  | { readonly kind: 'enter'; readonly mode: PlayMode }
  | { readonly kind: 'choose'; readonly actions: readonly WorldAction[] }
  | { readonly kind: 'sound'; readonly sample: 'bell' | 'bowl' }
  | { readonly kind: 'strike' }
  | { readonly kind: 'soon'; readonly actions: readonly WorldAction[] }
  | { readonly kind: 'none' };

const ACTION_MODES: Partial<Record<WorldAction, PlayMode>> = {
  incense: 'incense',
  beat: 'beat',
  sutra: 'sutra',
  endless: 'endless',
  journal: 'journal',
  gentle: 'gentle',
  radio: 'radio',
  fortune: 'fortune',
  room: 'room',
};

/** The play mode an action opens, or null for actions that do not open one. */
export function modeForAction(action: WorldAction): PlayMode | null {
  return ACTION_MODES[action] ?? null;
}

function routeAction(action: WorldAction): PickRoute {
  if (isComingSoon(action)) return { kind: 'soon', actions: [action] };
  const mode = modeForAction(action);
  if (mode) return { kind: 'enter', mode };
  if (action === 'bell' || action === 'bowl') return { kind: 'sound', sample: action };
  if (action === 'strike') return { kind: 'strike' };
  return { kind: 'soon', actions: [action] };
}

/** What picking something that offers `actions` does: one playable action goes straight in, several ask. */
export function routeActions(actions: readonly WorldAction[]): PickRoute {
  const playable = actions.filter((action) => routeAction(action).kind !== 'soon');
  if (actions.length === 0) return { kind: 'none' };
  if (playable.length === 0) return { kind: 'soon', actions };
  if (playable.length > 1) return { kind: 'choose', actions: playable };
  const only = playable[0];
  return only ? routeAction(only) : { kind: 'none' };
}

/** The first session step still to do (in the usual order), or null when all three are done. */
export function nextSessionStep(steps: Readonly<Record<SessionStep, boolean>>): SessionStep | null {
  return SESSION_STEPS.find((step) => !steps[step]) ?? null;
}
