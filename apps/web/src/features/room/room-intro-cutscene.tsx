/**
 * The room's entry cutscene in the 3D yard: as the panel opens the stage already walks the character to the censer
 * (MODE_LOOK.room), and here the three sticks rise, light with a burn sweep and start to smoke, with the bell and a
 * happy face, before the room card shows. Letterbox bars and a caption make it read as a scene; a tap anywhere (or
 * Space/Enter) skips it. Full length once per app session, short after that or with reduced motion.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { buzz, playSample } from '../../audio/audio-engine';
import { useGameSession } from '../../game/game-session-context';
import { type PlayModeProps, useRegisterStrike } from '../../modes/mode-chrome';
import type { PlayStage } from '../../modes/play-stage';
import { useRoomGameText } from './room-game-messages';
import { applyIncenseLook, introDurationMs, introIgniteAtMs, introLook } from './room-incense-timeline';

/** Whether the full intro has played in this app session (a reload plays it again). */
let fullIntroPlayed = false;

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface RoomIntro {
  readonly running: boolean;
  /** Durations for the caption's progress bar. */
  readonly durationMs: number;
  skip(): void;
}

export function useRoomIntro(stage: PlayStage): RoomIntro {
  const { progress } = useGameSession();
  const ambient = useRef(progress.ambientSounds);
  const [setup] = useState(() => {
    const reducedMotion = prefersReducedMotion();
    const durationMs = introDurationMs(!fullIntroPlayed, reducedMotion);
    return { reducedMotion, durationMs };
  });
  const [running, setRunning] = useState(true);
  const finished = useRef(false);

  const finish = useCallback((): void => {
    if (finished.current) return;
    finished.current = true;
    applyIncenseLook(stage, introLook(setup.durationMs, setup.durationMs, setup.reducedMotion));
    setRunning(false);
  }, [stage, setup]);

  useEffect(() => {
    fullIntroPlayed = true;
    const startedAt = performance.now();
    const igniteAt = introIgniteAtMs(setup.durationMs);
    let ignited = false;
    let frame = 0;
    const step = (): void => {
      if (finished.current) return;
      const elapsed = performance.now() - startedAt;
      applyIncenseLook(stage, introLook(elapsed, setup.durationMs, setup.reducedMotion));
      if (!ignited && elapsed >= igniteAt) {
        ignited = true;
        if (ambient.current) playSample('bell', { gain: 0.6 });
        buzz(15);
        stage.flashFace('happy', 1600);
      }
      if (elapsed >= setup.durationMs) finish();
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [stage, setup, finish]);

  return { running, durationMs: setup.durationMs, skip: finish };
}

interface CutsceneProps {
  readonly intro: RoomIntro;
  readonly registerStrike: PlayModeProps['registerStrike'];
}

/** The cutscene's layer: letterbox, caption and a whole-screen skip button. */
export function RoomIntroCutscene({ intro, registerStrike }: CutsceneProps): ReactNode {
  const text = useRoomGameText();
  useRegisterStrike(registerStrike, intro.skip);
  return (
    <button type="button" className="room-intro" data-id="room-intro" aria-label={text('intro.skip')} onClick={intro.skip}>
      <span className="room-intro-bar room-intro-bar-top" aria-hidden="true" />
      <span className="room-intro-bar room-intro-bar-bottom" aria-hidden="true" />
      <span className="room-intro-caption" aria-hidden="true">
        {text('intro.caption')}
        <span className="room-intro-progress" style={{ animationDuration: `${intro.durationMs}ms` }} />
      </span>
      <span className="room-intro-skip" aria-hidden="true">
        {text('intro.skip')}
      </span>
    </button>
  );
}
