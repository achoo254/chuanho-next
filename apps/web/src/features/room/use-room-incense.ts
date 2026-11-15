/**
 * The incense sticks in the 3D censer while the room panel is open: linked to the player's real stick (redrawn every
 * second on the server's clock), the "light my stick" cutscene, and the burn the minigame starts from. Paused while
 * the entry cutscene or the minigame drives the sticks itself. Always puts the sticks away when the panel closes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { buzz, playSample } from '../../audio/audio-engine';
import { useGameSession } from '../../game/game-session-context';
import type { PlayStage } from '../../modes/play-stage';
import { LIGHT_UP_IGNITE_MS, LIGHT_UP_MS, type MyStickSource, PUT_AWAY, applyIncenseLook, lightUpLook, liveLook, myStickStatus } from './room-incense-timeline';

const LINK_EVERY_MS = 1_000;
/** The burn the minigame shows when the player has no burning stick (practice). */
const PRACTICE_BURN = 0.15;

export interface RoomIncense {
  /** Plays the light-up cutscene (bell, happy face) over the just-lit stick. */
  celebrateLight(): void;
  /** True while the light-up cutscene plays (the card steps aside so the censer is seen). */
  readonly lightingUp: boolean;
  /** The burn the minigame starts from: the real stick's, or a practice stick's. */
  baseBurn(): number;
}

export function useRoomIncense(stage: PlayStage, source: MyStickSource, active: boolean): RoomIncense {
  const { progress } = useGameSession();
  const sourceRef = useRef(source);
  const lightUpAt = useRef<number | null>(null);
  const [lightingUp, setLightingUp] = useState(false);
  const ambient = useRef(progress.ambientSounds);
  useEffect(() => {
    sourceRef.current = source;
    ambient.current = progress.ambientSounds;
  }, [source, progress.ambientSounds]);

  // The live link. Applied on the next frame too: when the panel mounts in the same commit as the mode change, the
  // stage's own mode switch (which puts the sticks away) runs after this effect.
  const { inRoom, stick, offset } = source;
  useEffect(() => {
    if (!active) return;
    const apply = (): void => {
      if (lightUpAt.current !== null) return;
      applyIncenseLook(stage, liveLook(myStickStatus(sourceRef.current, Date.now())));
    };
    apply();
    const frame = requestAnimationFrame(apply);
    const timer = window.setInterval(apply, LINK_EVERY_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [stage, active, inRoom, stick, offset]);

  // Whatever happens, the sticks leave with the panel (and a light-up still running stops drawing).
  useEffect(
    () => () => {
      lightUpAt.current = null;
      applyIncenseLook(stage, PUT_AWAY);
    },
    [stage],
  );

  const celebrateLight = useCallback((): void => {
    const startedAt = performance.now();
    lightUpAt.current = startedAt;
    setLightingUp(true);
    let ignited = false;
    const step = (): void => {
      if (lightUpAt.current !== startedAt) return;
      const elapsed = performance.now() - startedAt;
      const status = myStickStatus(sourceRef.current, Date.now());
      applyIncenseLook(stage, lightUpLook(elapsed, status.kind === 'burning' ? status.progress : 0));
      if (!ignited && elapsed >= LIGHT_UP_IGNITE_MS) {
        ignited = true;
        if (ambient.current) playSample('bell', { gain: 0.7 });
        buzz([20, 60, 20]);
        stage.flashFace('happy', 1400);
      }
      if (elapsed < LIGHT_UP_MS) requestAnimationFrame(step);
      else {
        lightUpAt.current = null;
        setLightingUp(false);
        applyIncenseLook(stage, liveLook(status));
      }
    };
    requestAnimationFrame(step);
  }, [stage]);

  const baseBurn = useCallback((): number => {
    const status = myStickStatus(sourceRef.current, Date.now());
    return status.kind === 'burning' ? status.progress : PRACTICE_BURN;
  }, []);

  return { celebrateLight, lightingUp, baseBurn };
}
