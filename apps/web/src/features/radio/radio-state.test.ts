import { describe, expect, it } from 'vitest';
import { RADIO_MODES } from './radio-modes';
import { type RadioState, deriveRadio, initialRadioState, radioReducer } from './radio-state';

const MIN = 60_000;
const at = (state: RadioState, nowMs: number): RadioState => radioReducer(state, { type: 'tick', nowMs });

describe('radio state', () => {
  it('opens on the mode the hour suggests, playing, with that mode\'s defaults', () => {
    const night = deriveRadio(initialRadioState(0, 23));
    expect(night.mode.id).toBe('sleep');
    expect(night.timer?.remainingMs).toBe(30 * MIN);
    expect(night.pomodoro).toBeNull();
    expect(night.paused).toBe(false);
    expect(night.level).toBeCloseTo(RADIO_MODES.sleep.gain);

    const day = deriveRadio(initialRadioState(0, 10));
    expect(day.mode.id).toBe('work');
    expect(day.timer).toBeNull();
    expect(day.pomodoro).toEqual({ phase: 'focus', remainingMs: 25 * MIN, switches: 0 });
  });

  it('fades the sleep music out over the end of the timer, then pauses', () => {
    let state = radioReducer(initialRadioState(0, 23), { type: 'pickTimer', timer: 15, nowMs: 0 });
    expect(deriveRadio(at(state, 5 * MIN)).level).toBeCloseTo(RADIO_MODES.sleep.gain);
    const fading = deriveRadio(at(state, 12.5 * MIN)).level;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(RADIO_MODES.sleep.gain);
    state = at(state, 15 * MIN);
    expect(deriveRadio(state)).toMatchObject({ asleep: true, paused: true, level: 0 });
  });

  it('starts the chosen timer over when playing again after it ran out', () => {
    let state = radioReducer(initialRadioState(0, 23), { type: 'pickTimer', timer: 15, nowMs: 0 });
    state = radioReducer(state, { type: 'togglePlay', nowMs: 20 * MIN });
    const view = deriveRadio(state);
    expect(view.paused).toBe(false);
    expect(view.timer?.remainingMs).toBe(15 * MIN);
  });

  it('pauses and plays without touching the timer while it runs', () => {
    let state = initialRadioState(0, 23);
    state = radioReducer(state, { type: 'togglePlay', nowMs: MIN });
    expect(deriveRadio(state)).toMatchObject({ paused: true, level: 0 });
    state = radioReducer(state, { type: 'togglePlay', nowMs: 2 * MIN });
    expect(deriveRadio(state).paused).toBe(false);
    expect(deriveRadio(state).timer?.remainingMs).toBe(28 * MIN);
  });

  it('runs until stopped with the endless timer', () => {
    const state = radioReducer(initialRadioState(0, 23), { type: 'pickTimer', timer: null, nowMs: 0 });
    expect(deriveRadio(at(state, 10 * 60 * MIN))).toMatchObject({ asleep: false, paused: false });
  });

  it('switches modes with fresh defaults, and ignores choosing the mode already on', () => {
    const start = initialRadioState(0, 23);
    expect(radioReducer(start, { type: 'choose', choice: 'auto', nowMs: 5 })).toBe(start);
    const work = radioReducer(start, { type: 'choose', choice: 'work', nowMs: 10 * MIN });
    expect(deriveRadio(work)).toMatchObject({ timer: null, pomodoro: { phase: 'focus', switches: 0 } });
    expect(deriveRadio(at(work, 36 * MIN)).pomodoro).toEqual({ phase: 'break', remainingMs: 4 * MIN, switches: 1 });
    const back = radioReducer(work, { type: 'choose', choice: 'sleep', nowMs: 40 * MIN });
    expect(deriveRadio(back).timer?.remainingMs).toBe(30 * MIN);
  });

  it('turns the focus rhythm off and back on from zero', () => {
    let state = initialRadioState(0, 10);
    state = radioReducer(state, { type: 'togglePomodoro', nowMs: 3 * MIN });
    expect(deriveRadio(state).pomodoro).toBeNull();
    state = radioReducer(state, { type: 'togglePomodoro', nowMs: 7 * MIN });
    expect(deriveRadio(at(state, 8 * MIN)).pomodoro).toEqual({ phase: 'focus', remainingMs: 24 * MIN, switches: 0 });
  });

  it('keeps the same state object for a tick at the same time', () => {
    const state = initialRadioState(0, 10);
    expect(at(state, 0)).toBe(state);
  });
});
