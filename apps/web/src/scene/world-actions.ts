/**
 * The world is the menu: each thing in the yard that can be tapped leads to an action. Plain data and lookups, shared
 * by the scene (which prop was tapped), the corner icon bar (the same actions without aiming) and the keyboard.
 */

export const WORLD_ACTIONS = ['incense', 'beat', 'endless', 'sutra', 'bell', 'bowl', 'journal', 'gentle', 'radio', 'fortune', 'room', 'strike'] as const;
export type WorldAction = (typeof WORLD_ACTIONS)[number];

export const INTERACTIVE_PROPS = ['censer', 'sutraShelf', 'mo', 'bell', 'bowl', 'woodenBoard'] as const;
export type InteractivePropId = (typeof INTERACTIVE_PROPS)[number];

/** What each prop offers: the censer lights incense, the wooden fish offers both drumming modes, and so on. */
export const PROP_ACTIONS: Readonly<Record<InteractivePropId, readonly WorldAction[]>> = {
  censer: ['incense'],
  sutraShelf: ['sutra'],
  mo: ['beat', 'endless'],
  bell: ['bell'],
  bowl: ['bowl'],
  woodenBoard: ['journal', 'gentle', 'radio'],
};

/** Actions whose screens do not exist yet: they show a "coming soon" mark instead. */
const COMING_SOON: ReadonlySet<WorldAction> = new Set<WorldAction>(['fortune']);

/** The corner icon bar: every action reachable without aiming at the scene. */
export const SHORTCUT_BAR_ACTIONS: readonly WorldAction[] = ['incense', 'beat', 'sutra', 'journal', 'gentle', 'radio', 'room'];

/** Number keys 1–3 pick the three steps of a session, in order. */
export const NUMBER_KEY_ACTIONS: readonly WorldAction[] = ['incense', 'beat', 'sutra'];

export const isInteractiveProp = (value: unknown): value is InteractivePropId =>
  typeof value === 'string' && (INTERACTIVE_PROPS as readonly string[]).includes(value);

/** The actions a tapped prop offers; nothing for props that are only scenery. */
export function actionsForProp(prop: unknown): readonly WorldAction[] {
  return isInteractiveProp(prop) ? PROP_ACTIONS[prop] : [];
}

export function isComingSoon(action: WorldAction): boolean {
  return COMING_SOON.has(action);
}

/** The prop that stands for an action in the scene (to glow when the action is picked from the bar or keyboard). */
export function propForAction(action: WorldAction): InteractivePropId | null {
  if (action === 'strike') return 'mo';
  for (const prop of INTERACTIVE_PROPS) if (PROP_ACTIONS[prop].includes(action)) return prop;
  return null;
}
