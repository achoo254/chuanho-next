/**
 * Tụng kinh: the text lights up one word per strike of the wooden bell, the way chanting follows the mõ. An optional
 * lofi pad plays underneath. The recorded voice is not ready yet, so its switch shows "coming soon" and does nothing.
 * Reaching the last word finishes the chanting step of the session.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { buzz, playSample } from '../audio/audio-engine';
import { useGameSession } from '../game/game-session-context';
import { SUTRA_LINES, SUTRA_WORD_COUNT } from '../game/sutra-text';
import { useI18n } from '../i18n/i18n';
import { LayeredScene } from '../scene/layered-scene';
import { TapCharacter } from '../tap/tap-character';
import { useTapAnimation } from '../tap/use-tap-animation';
import { ScreenHeader } from '../ui/screen-header';
import { useLofiBackdrop } from './use-lofi-backdrop';

/** Global word index of each line's first word. */
const LINE_STARTS = SUTRA_LINES.reduce<number[]>((starts, _line, index) => {
  const previous = SUTRA_LINES[index - 1];
  starts.push(index === 0 ? 0 : (starts[index - 1] ?? 0) + (previous?.words.length ?? 0));
  return starts;
}, []);

export function TungKinhScreen({ onBack, onSessionComplete }: { onBack: () => void; onSessionComplete: () => void }): ReactNode {
  const { t } = useI18n();
  const { progress, completeStep } = useGameSession();
  const [lit, setLit] = useState(0); // words lit so far
  const [lofi, setLofi] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const currentRef = useRef<HTMLSpanElement>(null);
  const done = lit >= SUTRA_WORD_COUNT;
  useLofiBackdrop(lofi);

  const litRef = useRef(0);
  // Each strike lights one more word; the strike that lights the last word finishes the chanting step.
  const tap = useTapAnimation(
    useCallback(() => {
      playSample('mo');
      buzz(10);
      if (litRef.current >= SUTRA_WORD_COUNT) return;
      litRef.current += 1;
      setLit(litRef.current);
      if (litRef.current < SUTRA_WORD_COUNT) return;
      if (progress.ambientSounds) playSample('bowl', { gain: 0.7 });
      if (completeStep('sutra')) setSessionDone(true);
    }, [progress.ambientSounds, completeStep]),
  );

  // Keep the word being chanted in view.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    currentRef.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [lit]);

  const restart = (): void => {
    litRef.current = 0;
    setSessionDone(false);
    setLit(0);
  };

  return (
    <section className="game-screen" data-id="tung-kinh">
      <ScreenHeader
        title={t('sutra.title')}
        onBack={onBack}
        end={<span className="chip">{t('sutra.progress', { n: lit, total: SUTRA_WORD_COUNT })}</span>}
      />
      <LayeredScene backdrop="courtyardAlt" className="sutra-scene" dataId="tung-kinh-scene">
        <div className="sutra-scroll" data-id="tung-kinh-text">
          <p className="sutra-source">{t('sutra.source')}</p>
          {SUTRA_LINES.map((line, lineIndex) => (
            <p key={lineIndex} className="sutra-line" lang="vi">
              {line.words.map((word, wordIndex) => {
                const index = (LINE_STARTS[lineIndex] ?? 0) + wordIndex;
                const state = index < lit ? 'is-lit' : index === lit ? 'is-current' : '';
                return (
                  <span key={wordIndex} ref={index === lit ? currentRef : undefined} className={`sutra-word ${state}`}>
                    {word}{' '}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
        <TapCharacter animation={tap} label={t('sutra.tapLabel')} onTap={tap.strike} className="sutra-character" dataId="tung-kinh-tap" />
        {done && (
          <div className="overlay-card" role="status" data-id="tung-kinh-done">
            <h2 className="overlay-title">{t('sutra.done')}</h2>
            <div className="level-row">
              <button type="button" className="btn-secondary" data-id="tung-kinh-again" onClick={restart}>
                {t('sutra.again')}
              </button>
              <button type="button" className="btn-primary" data-id="tung-kinh-continue" onClick={sessionDone ? onSessionComplete : onBack}>
                {sessionDone ? t('common.continue') : t('common.backToYard')}
              </button>
            </div>
          </div>
        )}
      </LayeredScene>
      <div className="session-card session-card-compact" data-id="tung-kinh-controls">
        <p className="session-note">{t('sutra.hint')}</p>
        <div className="session-row">
          <button type="button" className="btn-toggle" aria-pressed={lofi} data-id="tung-kinh-lofi" onClick={() => setLofi((v) => !v)}>
            {t('sutra.lofi')}: {lofi ? t('common.on') : t('common.off')}
          </button>
          <button type="button" className="btn-toggle" aria-disabled="true" disabled data-id="tung-kinh-voice">
            {t('sutra.voiceSoon')}
          </button>
        </div>
      </div>
    </section>
  );
}
