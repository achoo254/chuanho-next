/**
 * What the character does by itself in the yard, as data: where each scene happens, how often it is picked, how
 * long it lasts, and what the speech bubble may say. The picker never repeats the scene just played, so the yard
 * always has something new going on.
 */
import type { CharacterSpotId } from '../scene/diorama-layout';

export const ACTIVITIES = ['meditate', 'chant', 'knock', 'pray', 'bell', 'look', 'wave', 'rest'] as const;
export type ActivityId = (typeof ACTIVITIES)[number];

/** Subjects of the speech bubble: one per scene, plus walking, noticing a tap, and coming back from a play mode. */
export const BUBBLE_TOPICS = [...ACTIVITIES, 'walk', 'notice', 'welcome', 'karma'] as const;
export type BubbleTopic = (typeof BUBBLE_TOPICS)[number];
/** Each topic has this many lines in each language (hud-messages.ts). */
export const LINES_PER_TOPIC = 3;
export type BubbleIndex = 0 | 1 | 2;

export interface ActivitySpec {
  /** A named spot, or `wander` for any open point of the yard. */
  readonly spot: CharacterSpotId | 'wander';
  readonly weight: number;
  readonly durationMs: readonly [number, number];
  /** A second line halfway through (long, quiet scenes). */
  readonly midLine: boolean;
}

export const ACTIVITY_SPECS: Readonly<Record<ActivityId, ActivitySpec>> = {
  meditate: { spot: 'meditate', weight: 3, durationMs: [11_000, 16_000], midLine: true },
  chant: { spot: 'chant', weight: 3, durationMs: [8_000, 12_000], midLine: true },
  knock: { spot: 'mo', weight: 3, durationMs: [7_000, 10_500], midLine: false },
  pray: { spot: 'pray', weight: 3, durationMs: [8_000, 10_000], midLine: false },
  bell: { spot: 'bell', weight: 1.6, durationMs: [4_200, 5_200], midLine: false },
  look: { spot: 'wander', weight: 2, durationMs: [4_500, 6_500], midLine: false },
  wave: { spot: 'wander', weight: 1.5, durationMs: [3_200, 4_000], midLine: false },
  rest: { spot: 'rest', weight: 1.5, durationMs: [9_000, 13_000], midLine: true },
};

/** A random number in [0, 1); injected so tests can replay a schedule. */
export type Random = () => number;

/**
 * Weighted pick among the scenes, never `previous`; `preferred` (the player just tapped the wooden fish) gets a big
 * extra weight but is still not forced.
 */
export function pickActivity(random: Random, previous: ActivityId | null, preferred: ActivityId | null = null): ActivityId {
  const choices = ACTIVITIES.filter((id) => id !== previous);
  const weightOf = (id: ActivityId): number => ACTIVITY_SPECS[id].weight * (id === preferred ? 4 : 1);
  const total = choices.reduce((sum, id) => sum + weightOf(id), 0);
  let roll = Math.min(Math.max(random(), 0), 0.999_999) * total;
  for (const id of choices) {
    roll -= weightOf(id);
    if (roll < 0) return id;
  }
  return choices[choices.length - 1] ?? 'look';
}

export function pickDuration(random: Random, activity: ActivityId): number {
  const [low, high] = ACTIVITY_SPECS[activity].durationMs;
  return low + (high - low) * Math.min(Math.max(random(), 0), 1);
}

export function pickLine(random: Random): BubbleIndex {
  const index = Math.floor(Math.min(Math.max(random(), 0), 0.999_999) * LINES_PER_TOPIC);
  return (index === 1 ? 1 : index === 2 ? 2 : 0) satisfies BubbleIndex;
}

/** The message key of a bubble line (checked against the dictionary where it is shown). */
export const bubbleKey = (topic: BubbleTopic, index: BubbleIndex): `bubble.${BubbleTopic}.${BubbleIndex}` => `bubble.${topic}.${index}`;
