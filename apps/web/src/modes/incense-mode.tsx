/**
 * Lighting incense in 3D: hold a finger or the mouse on the censer (or hold Space on the hold button) and the stick
 * in it burns down, ember glowing and smoke rising, while the character joins its palms. Letting go pauses it. When
 * lit, the bell rings (if enabled) and the session step is done, with the next step one tap away.
 */
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { buzz, playSample } from '../audio/audio-engine';
import { useGameSession } from '../game/game-session-context';
import { HudIcon } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { ModeBar, type PlayModeProps, StepDoneCard } from './mode-chrome';
import { usePlayText } from './play-mode-messages';

/** Holding time to light the stick fully (as in the 2D version). */
const BURN_MS = 2600;
const BUZZ_EVERY_MS = 420;

type IncenseProps = PlayModeProps & { readonly pickPropAt: (x: number, y: number) => string | null };

export function IncenseMode({ stage, onBack, onOpen, onSessionComplete, pickPropAt }: IncenseProps): ReactNode {
  const { t } = useI18n();
  const text = usePlayText();
  const { progress, completeStep } = useGameSession();
  const [burnt, setBurnt] = useState(0);
  const [holding, setHolding] = useState(false);
  const finished = useRef(false);
  const done = burnt >= 1;

  useEffect(() => {
    stage.setIncense(burnt, holding && !done);
  }, [stage, burnt, holding, done]);

  // While held, burn on animation frames; stop when released or lit.
  useEffect(() => {
    if (!holding || done) return;
    let frame = 0;
    let last = performance.now();
    let sinceBuzz = BUZZ_EVERY_MS;
    const step = (now: number): void => {
      const elapsed = now - last;
      last = now;
      sinceBuzz += elapsed;
      if (sinceBuzz >= BUZZ_EVERY_MS) {
        buzz(8);
        sinceBuzz = 0;
      }
      setBurnt((value) => Math.min(1, value + elapsed / BURN_MS));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [holding, done]);

  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    if (progress.ambientSounds) playSample('bell', { gain: 0.7 });
    buzz([20, 60, 20]);
    stage.flashFace('happy', 1200);
    if (completeStep('incense')) onSessionComplete();
  }, [done, progress.ambientSounds, completeStep, onSessionComplete, stage]);

  // A press anywhere is checked against the censer (and the stick in it): only those light the incense.
  useEffect(() => {
    if (done) return;
    const release = (): void => setHolding(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [done]);

  const percent = Math.round(burnt * 100);
  return (
    <>
      {!done && (
        <div
          className="play-hold-pad"
          data-id="incense-hold-pad"
          aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button > 0) return;
            if (pickPropAt(event.clientX, event.clientY) === 'censer') setHolding(true);
          }}
          onContextMenu={(event) => event.preventDefault()}
        />
      )}
      <ModeBar onBack={onBack}>
        <div
          className={`play-hold-btn${holding ? ' is-holding' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label={text('holdIncense')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={t('incense.progress', { p: percent })}
          data-id="incense-hold"
          style={{ '--burnt': burnt.toFixed(3) } as CSSProperties}
          onPointerDown={() => setHolding(true)}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              setHolding(true);
            }
          }}
          onKeyUp={() => setHolding(false)}
        >
          <HudIcon name="incense" size={22} />
        </div>
      </ModeBar>
      {!done && burnt === 0 && (
        <p className="play-hint" aria-hidden="true">
          {t('incense.hint')}
        </p>
      )}
      {done && <StepDoneCard title={t('incense.done')} onOpen={onOpen} onBack={onBack} />}
    </>
  );
}
