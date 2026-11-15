/**
 * The radio's listening modes as one table: a new mode is one more row (plus its words in radio-messages.ts).
 * Each row says how the yard looks, how loud and which kind of music plays, which sleep timers it offers and
 * whether the 25/5 focus rhythm runs. Pure data and choice rules, tested apart from React and audio.
 */
import type { FaceName } from '../../character/face-expressions';
import type { IconName } from '../../hud/hud-icons';
import type { LightingPresetId } from '../../scene/lighting-presets';

export const RADIO_MODE_IDS = ['sleep', 'work'] as const;
export type RadioModeId = (typeof RADIO_MODE_IDS)[number];

/** What the player picked: a mode, or "auto" (the mode suggested by the hour). */
export type RadioChoice = RadioModeId | 'auto';
export const RADIO_CHOICES: readonly RadioChoice[] = ['auto', ...RADIO_MODE_IDS];

/** A sleep-timer choice in minutes, or null for "until I stop". */
export type SleepTimerChoice = number | null;

export interface RadioMode {
  readonly id: RadioModeId;
  readonly icon: IconName;
  /** The yard's time of day while the mode plays (restored when the radio closes). */
  readonly lighting: LightingPresetId;
  /** The music's final level, 0–1 (1 = as loud as the yard's backdrop). */
  readonly gain: number;
  /** Library tags (scene names from tools/chuanho-music) picked first; the no-repeat rule still wins. */
  readonly preferredTags: readonly string[];
  /** Sleep-timer choices offered; empty when the mode has no sleep timer. */
  readonly sleepTimers: readonly SleepTimerChoice[];
  /** The timer that starts with the mode (one of `sleepTimers`). */
  readonly defaultSleepTimer: SleepTimerChoice;
  /** Whether the focus/break chime rhythm runs (the player can still switch it off). */
  readonly pomodoro: boolean;
  /** The screen dims after this long without a touch, or null to stay lit. */
  readonly dimAfterIdleMs: number | null;
  /** The character's face while the mode plays, or null to leave it be. */
  readonly characterFace: FaceName | null;
}

export const RADIO_MODES: Readonly<Record<RadioModeId, RadioMode>> = {
  sleep: {
    id: 'sleep',
    icon: 'moon',
    lighting: 'lanternNight',
    gain: 0.6,
    preferredTags: ['moon', 'stars', 'evening', 'rain', 'snow'],
    sleepTimers: [15, 30, 60, null],
    defaultSleepTimer: 30,
    pomodoro: false,
    dimAfterIdleMs: 20_000,
    characterFace: 'sleepy',
  },
  work: {
    id: 'work',
    icon: 'mist',
    lighting: 'mistyMorning',
    gain: 0.75,
    preferredTags: ['dawn', 'mist', 'tea', 'lotus', 'monastery', 'pine'],
    sleepTimers: [],
    defaultSleepTimer: null,
    pomodoro: true,
    dimAfterIdleMs: null,
    characterFace: null,
  },
};

/** From this hour (local time) until `SLEEP_UNTIL_HOUR` the radio suggests sleep; the rest of the day, work. */
export const SLEEP_FROM_HOUR = 21;
export const SLEEP_UNTIL_HOUR = 5;

/** The mode "auto" stands for at `hour` (0–23); only a pre-selected default, the player always chooses. */
export function suggestedRadioMode(hour: number): RadioModeId {
  return hour >= SLEEP_FROM_HOUR || hour < SLEEP_UNTIL_HOUR ? 'sleep' : 'work';
}

/** The mode that plays for a choice made at `hour`. */
export function resolveRadioMode(choice: RadioChoice, hour: number): RadioMode {
  return RADIO_MODES[choice === 'auto' ? suggestedRadioMode(hour) : choice];
}
