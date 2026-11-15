/**
 * Lighting incense, the first step of a session: hold a finger on the stick and it burns down while the finger
 * stays (lifting pauses it), with smoke rising and a light buzz now and then. When it has burnt enough, the bell
 * rings (if enabled) and the step is done.
 */
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { buzz, playSample } from '../audio/audio-engine';
import { useGameSession } from '../game/game-session-context';
import { useI18n } from '../i18n/i18n';
import { LayeredScene, SceneLayer } from '../scene/layered-scene';
import { ScreenHeader } from '../ui/screen-header';

/** Holding time to light the stick fully. */
const BURN_MS = 2600;
const BUZZ_EVERY_MS = 420;

export function IncenseScreen({ onBack, onSessionComplete }: { onBack: () => void; onSessionComplete: () => void }): ReactNode {
  const { t } = useI18n();
  const { progress, completeStep } = useGameSession();
  const [burnt, setBurnt] = useState(0); // 0..1
  const [holding, setHolding] = useState(false);
  const done = burnt >= 1;
  const frame = useRef(0);
  const finished = useRef(false);

  // While held, advance the burn on animation frames; stop when released or lit.
  useEffect(() => {
    if (!holding || done) return;
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
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [holding, done]);

  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    if (progress.ambientSounds) playSample('bell', { gain: 0.7 });
    buzz([20, 60, 20]);
    if (completeStep('incense')) onSessionComplete();
  }, [done, progress.ambientSounds, completeStep, onSessionComplete]);

  const percent = Math.round(burnt * 100);
  const release = (): void => setHolding(false);

  return (
    <section className="game-screen" data-id="incense">
      <ScreenHeader title={t('incense.title')} onBack={onBack} />
      <LayeredScene
        backdrop="courtyardAlt"
        className="incense-scene"
        dataId="incense-scene"
        layers={
          <SceneLayer depth={-12} className="incense-censer">
            <img src="/art/incense.webp" alt="" decoding="async" />
          </SceneLayer>
        }
      >
        <p className="scene-hint" aria-live="polite">
          {done ? t('incense.done') : t('incense.hint')}
        </p>
        <div
          className={`incense-stick${holding ? ' is-holding' : ''}${burnt > 0 ? ' is-lit' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label={t('incense.stickLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={t('incense.progress', { p: percent })}
          data-id="incense-stick"
          style={{ '--burnt': burnt.toFixed(3) } as CSSProperties}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setHolding(true);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              setHolding(true);
            }
          }}
          onKeyUp={release}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="incense-smoke" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="incense-ember" aria-hidden="true" />
          <span className="incense-body" aria-hidden="true" />
          <span className="incense-handle" aria-hidden="true" />
        </div>
        {done && (
          <button type="button" className="btn-primary scene-cta" data-id="incense-continue" onClick={onBack}>
            {t('common.backToYard')}
          </button>
        )}
      </LayeredScene>
    </section>
  );
}
