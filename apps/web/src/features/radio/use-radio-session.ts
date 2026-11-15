/**
 * Runs the radio while its screen is open: holds a share of the background music (so the yard's session goes on,
 * and goes on after the radio closes), applies the state from radio-state.ts to the world (time of day, music level,
 * pause, preferred tracks, the character's face, the focus-rhythm chimes) and puts everything back on the way out:
 * the time of day the player had, the music at full level, unpaused, with no track preference.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { playSample } from '../../audio/audio-engine';
import { acquireBackgroundMusic, backgroundMusicControls } from '../../audio/background-music';
import { rampMusicMasterLevel, restoreMusicMasterLevel } from '../../audio/music-master-level';
import { type MusicSessionStats, NO_STATS } from '../../audio/music-session';
import type { PlayStage } from '../../modes/play-stage';
import type { LightingControl } from '../panel-registry';
import type { RadioChoice, SleepTimerChoice } from './radio-modes';
import { type RadioState, type RadioView, deriveRadio, initialRadioState, radioReducer } from './radio-state';

const TICK_MS = 1000;
/** How long one face flash lasts; refreshed every tick, so the face holds while the mode wants it. */
const FACE_HOLD_MS = TICK_MS + 600;
const CHIME_GAIN = 0.7;

export interface RadioSession extends RadioView {
  readonly state: RadioState;
  readonly statsAtOpen: MusicSessionStats;
  readonly stats: MusicSessionStats;
  choose(choice: RadioChoice): void;
  pickTimer(timer: SleepTimerChoice): void;
  togglePlay(): void;
  togglePomodoro(): void;
  skip(): void;
}

const readStats = (): MusicSessionStats => backgroundMusicControls()?.stats() ?? NO_STATS;

export function useRadioSession(lighting: LightingControl, stage: PlayStage): RadioSession {
  const [state, dispatch] = useReducer(radioReducer, null, () => initialRadioState(Date.now(), new Date().getHours()));
  const [statsAtOpen] = useState(readStats);
  const [stats, setStats] = useState(statsAtOpen);
  const view = deriveRadio(state);
  const { mode, paused, level, pomodoro } = view;

  // The music: one more holder of the shared session; on the way out, leave it as the yard expects it.
  useEffect(() => {
    const release = acquireBackgroundMusic();
    return () => {
      const controls = backgroundMusicControls();
      controls?.setPaused(false);
      controls?.setPreferredTags([]);
      restoreMusicMasterLevel();
      release();
    };
  }, []);

  useEffect(() => {
    backgroundMusicControls()?.setPreferredTags(mode.preferredTags);
  }, [mode.preferredTags]);

  useEffect(() => {
    backgroundMusicControls()?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    rampMusicMasterLevel(level, level === 0 ? 0.5 : 1.2);
  }, [level]);

  // The time of day: the mode's look while open, the player's own look again when the radio closes.
  const setLighting = lighting.set;
  const presetAtOpen = useRef(lighting.preset);
  useEffect(() => {
    const restore = presetAtOpen.current;
    return () => setLighting(restore);
  }, [setLighting]);
  useEffect(() => {
    setLighting(mode.lighting);
  }, [setLighting, mode.lighting]);

  // The clock: one tick a second drives the timers, the readouts and the held face.
  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', nowMs: Date.now() });
      setStats(readStats());
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode.characterFace && !paused) stage.flashFace(mode.characterFace, FACE_HOLD_MS);
  }, [stage, mode.characterFace, paused, state.nowMs]);

  // A soft chime when the focus rhythm switches: a bowl for the break, a bell for back to work.
  const lastSwitches = useRef<number | null>(null);
  const switches = pomodoro?.switches ?? null;
  const phase = pomodoro?.phase ?? null;
  useEffect(() => {
    const previous = lastSwitches.current;
    lastSwitches.current = switches;
    if (switches === null || previous === null || switches <= previous) return;
    playSample(phase === 'break' ? 'bowl' : 'bell', { gain: CHIME_GAIN });
  }, [switches, phase]);

  const choose = useCallback((choice: RadioChoice) => dispatch({ type: 'choose', choice, nowMs: Date.now() }), []);
  const pickTimer = useCallback((timer: SleepTimerChoice) => dispatch({ type: 'pickTimer', timer, nowMs: Date.now() }), []);
  const togglePlay = useCallback(() => dispatch({ type: 'togglePlay', nowMs: Date.now() }), []);
  const togglePomodoro = useCallback(() => dispatch({ type: 'togglePomodoro', nowMs: Date.now() }), []);
  const skip = useCallback(() => backgroundMusicControls()?.skip(), []);

  return { ...view, state, statsAtOpen, stats, choose, pickTimer, togglePlay, togglePomodoro, skip };
}
