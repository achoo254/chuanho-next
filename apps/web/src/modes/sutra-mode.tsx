/**
 * Chanting in 3D: the camera lowers towards the sutra stand and the text floats on a sheet of paper (HTML, so it
 * reads clearly on phones and computers), one word lighting up per strike of the wooden fish. Only the Heart Sutra
 * opening and the public recitation already in sutra-text.ts, never anything else. An optional lofi pad underneath.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { playSample } from '../audio/audio-engine';
import { useGameSession } from '../game/game-session-context';
import { SUTRA_LINES, SUTRA_WORD_COUNT } from '../game/sutra-text';
import { IconButton } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { useLofiBackdrop } from '../screens/use-lofi-backdrop';
import { ModeBar, type PlayModeProps, StepDoneCard, StrikeTapLayer, useRegisterStrike } from './mode-chrome';
import { usePlayText } from './play-mode-messages';
import { playStrikeFeedback } from './strike-feedback';

/** Global word index of each line's first word. */
const LINE_STARTS = SUTRA_LINES.reduce<number[]>((starts, _line, index) => {
  starts.push(index === 0 ? 0 : (starts[index - 1] ?? 0) + (SUTRA_LINES[index - 1]?.words.length ?? 0));
  return starts;
}, []);

export function SutraMode({ stage, onBack, onOpen, onSessionComplete, registerStrike }: PlayModeProps): ReactNode {
  const { t } = useI18n();
  const text = usePlayText();
  const { progress, completeStep } = useGameSession();
  const [lit, setLit] = useState(0);
  const [lofi, setLofi] = useState(false);
  const litRef = useRef(0);
  const currentRef = useRef<HTMLSpanElement>(null);
  const done = lit >= SUTRA_WORD_COUNT;
  useLofiBackdrop(lofi);

  // Each strike lights one more word; the strike that lights the last word finishes the chanting step.
  const strike = (): void => {
    stage.strike();
    playStrikeFeedback(10);
    if (litRef.current >= SUTRA_WORD_COUNT) return;
    litRef.current += 1;
    setLit(litRef.current);
    if (litRef.current < SUTRA_WORD_COUNT) return;
    if (progress.ambientSounds) playSample('bowl', { gain: 0.7 });
    stage.flashFace('happy', 1200);
    if (completeStep('sutra')) onSessionComplete();
  };
  useRegisterStrike(registerStrike, strike);

  // Keep the word being chanted in view on the paper.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [lit]);

  const restart = (): void => {
    litRef.current = 0;
    setLit(0);
  };

  return (
    <>
      {!done && <StrikeTapLayer label={t('sutra.tapLabel')} onStrike={strike} dataId="sutra-pad" />}
      <ModeBar onBack={onBack}>
        <span className="play-chip" aria-label={t('sutra.progress', { n: lit, total: SUTRA_WORD_COUNT })} data-id="sutra-progress">
          {text('wordsLeft', { n: lit, total: SUTRA_WORD_COUNT })}
        </span>
        <IconButton icon={lofi ? 'soundOn' : 'soundOff'} label={`${t('sutra.lofi')}: ${lofi ? t('common.on') : t('common.off')}`} pressed={lofi} dataId="sutra-lofi" onClick={() => setLofi((v) => !v)} />
      </ModeBar>
      <section className="play-paper" aria-label={text('paper')} data-id="sutra-paper">
        <p className="play-paper-source">{t('sutra.source')}</p>
        <div className="play-paper-text" lang="vi">
          {SUTRA_LINES.map((line, lineIndex) => (
            <p key={lineIndex} className="play-paper-line">
              {line.words.map((word, wordIndex) => {
                const index = (LINE_STARTS[lineIndex] ?? 0) + wordIndex;
                const state = index < lit ? 'is-lit' : index === lit ? 'is-current' : '';
                return (
                  <span key={wordIndex} ref={index === lit ? currentRef : undefined} className={`play-word ${state}`}>
                    {word}{' '}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      </section>
      {done && (
        <StepDoneCard title={t('sutra.done')} onOpen={onOpen} onBack={onBack}>
          <button type="button" className="btn-secondary" data-id="sutra-again" onClick={restart}>
            {t('sutra.again')}
          </button>
        </StepDoneCard>
      )}
    </>
  );
}
