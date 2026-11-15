/**
 * The radio screen's state as a pure reducer plus what follows from it (which mode plays, whether the music is
 * paused, how loud it should be, the timer and focus-rhythm readings). Every action carries the clock reading
 * (`nowMs`), so the rules are tested without timers, React or audio; use-radio-session.ts applies the results.
 */
import { type PomodoroStatus, pomodoroStatus } from './pomodoro';
import { type RadioChoice, type RadioMode, type SleepTimerChoice, resolveRadioMode } from './radio-modes';
import { type SleepTimer, type SleepTimerStatus, sleepFadeLevel, sleepTimerStatus, startSleepTimer } from './sleep-timer';

export interface RadioState {
  readonly choice: RadioChoice;
  /** The local hour when the radio opened: what "auto" resolves against. */
  readonly hour: number;
  /** The player's play/pause (the sleep timer ending also pauses, see `deriveRadio`). */
  readonly playing: boolean;
  readonly timerChoice: SleepTimerChoice;
  readonly sleepTimer: SleepTimer | null;
  readonly pomodoroOn: boolean;
  readonly pomodoroStartedAtMs: number;
  readonly nowMs: number;
}

export type RadioAction =
  | { readonly type: 'choose'; readonly choice: RadioChoice; readonly nowMs: number }
  | { readonly type: 'pickTimer'; readonly timer: SleepTimerChoice; readonly nowMs: number }
  | { readonly type: 'togglePlay'; readonly nowMs: number }
  | { readonly type: 'togglePomodoro'; readonly nowMs: number }
  | { readonly type: 'tick'; readonly nowMs: number };

/** A mode freshly started at `nowMs`: its default timer and its focus rhythm from zero, music on. */
function enterMode(state: RadioState, choice: RadioChoice, nowMs: number): RadioState {
  const mode = resolveRadioMode(choice, state.hour);
  const timerChoice = mode.defaultSleepTimer;
  return {
    ...state,
    choice,
    playing: true,
    timerChoice,
    sleepTimer: mode.sleepTimers.length > 0 ? startSleepTimer(nowMs, timerChoice) : null,
    pomodoroOn: mode.pomodoro,
    pomodoroStartedAtMs: nowMs,
    nowMs,
  };
}

export function initialRadioState(nowMs: number, hour: number, choice: RadioChoice = 'auto'): RadioState {
  const blank: RadioState = {
    choice,
    hour,
    playing: true,
    timerChoice: null,
    sleepTimer: null,
    pomodoroOn: false,
    pomodoroStartedAtMs: nowMs,
    nowMs,
  };
  return enterMode(blank, choice, nowMs);
}

export interface RadioView {
  readonly mode: RadioMode;
  readonly timer: SleepTimerStatus | null;
  /** The sleep timer ran out: the music is off until the player plays again. */
  readonly asleep: boolean;
  readonly paused: boolean;
  /** The music's final level to ramp to (0 while paused). */
  readonly level: number;
  /** The focus rhythm, or null when the mode has none or the player turned it off. */
  readonly pomodoro: PomodoroStatus | null;
}

export function deriveRadio(state: RadioState): RadioView {
  const mode = resolveRadioMode(state.choice, state.hour);
  const timer = state.sleepTimer ? sleepTimerStatus(state.sleepTimer, state.nowMs) : null;
  const asleep = timer?.done ?? false;
  const paused = !state.playing || asleep;
  const level = paused ? 0 : mode.gain * sleepFadeLevel(timer?.fadeProgress ?? 0);
  const pomodoro = mode.pomodoro && state.pomodoroOn ? pomodoroStatus(state.pomodoroStartedAtMs, state.nowMs) : null;
  return { mode, timer, asleep, paused, level, pomodoro };
}

export function radioReducer(state: RadioState, action: RadioAction): RadioState {
  switch (action.type) {
    case 'choose':
      return action.choice === state.choice ? state : enterMode(state, action.choice, action.nowMs);
    case 'pickTimer':
      return { ...state, timerChoice: action.timer, sleepTimer: startSleepTimer(action.nowMs, action.timer), playing: true, nowMs: action.nowMs };
    case 'togglePlay': {
      const current = { ...state, nowMs: action.nowMs };
      const { paused, asleep, mode } = deriveRadio(current);
      if (!paused) return { ...current, playing: false };
      // Playing again after the timer ran out starts the chosen timer over.
      const sleepTimer = asleep && mode.sleepTimers.length > 0 ? startSleepTimer(action.nowMs, state.timerChoice) : state.sleepTimer;
      return { ...current, playing: true, sleepTimer };
    }
    case 'togglePomodoro':
      return { ...state, pomodoroOn: !state.pomodoroOn, pomodoroStartedAtMs: action.nowMs, nowMs: action.nowMs };
    case 'tick':
      return action.nowMs === state.nowMs ? state : { ...state, nowMs: action.nowMs };
  }
}
