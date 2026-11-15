/**
 * Release step 1: 21 strokes of the wooden fish. The whole screen is the strike pad (and Space strikes), exactly as
 * in endless mõ; a small ring at the top fills to 21, then the step reports done on its own after a short beat.
 */
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ModeBar, type PlayModeProps, StrikeTapLayer, useRegisterStrike } from '../../modes/mode-chrome';
import { playStrikeFeedback } from '../../modes/strike-feedback';
import { useJournalText } from './journal-messages';
import { RESET_STROKES, addStroke, isResetComplete, strokeFraction } from './release-steps';

/** Pause on the full ring before moving on, so the last stroke is seen and heard. */
const DONE_PAUSE_MS = 700;
const RING_R = 22;
const RING_LENGTH = 2 * Math.PI * RING_R;

interface ResetStepProps extends Pick<PlayModeProps, 'stage' | 'registerStrike'> {
  onDone(): void;
  onSkip(): void;
  onClose(): void;
}

export function ReleaseResetStep({ stage, registerStrike, onDone, onSkip, onClose }: ResetStepProps): ReactNode {
  const text = useJournalText();
  const [count, setCount] = useState(0);
  const complete = isResetComplete(count);

  // The journal's look keeps the character praying by the censer; for the strokes it walks to the wooden fish and the
  // camera frames it as in endless mõ, then goes back to the journal's look. (Leaving for the yard is safe: this
  // cleanup runs before the shell applies the yard's look.)
  useEffect(() => {
    stage.setMode('endless');
    return () => stage.setMode('journal');
  }, [stage]);

  const strike = useCallback((): void => {
    if (complete) return;
    stage.strike();
    playStrikeFeedback(10);
    setCount(addStroke);
  }, [stage, complete]);
  useRegisterStrike(registerStrike, strike);

  useEffect(() => {
    if (!complete) return;
    const timer = window.setTimeout(onDone, DONE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [complete, onDone]);

  return (
    <>
      <StrikeTapLayer label={text('reset.tap')} onStrike={strike} dataId="release-reset-pad" />
      <div className="release-reset-card" data-id="release-reset">
        <svg className="release-ring" viewBox="0 0 52 52" width={64} height={64} aria-hidden="true" focusable="false">
          <circle className="release-ring-track" cx={26} cy={26} r={RING_R} />
          <circle
            className="release-ring-fill"
            cx={26}
            cy={26}
            r={RING_R}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - strokeFraction(count))}
            transform="rotate(-90 26 26)"
          />
        </svg>
        <div>
          <p className="panel-line" role="status">{complete ? text('reset.done') : text('reset.title', { total: RESET_STROKES })}</p>
          <p className="release-reset-count">{text('reset.count', { n: count, total: RESET_STROKES })}</p>
        </div>
      </div>
      <ModeBar onBack={onClose}>
        <span className="play-chip">{text('release.stepOf', { n: 1 })}</span>
        <button type="button" className="play-chip release-skip" data-id="release-reset-skip" onClick={onSkip}>
          {text('release.skip')}
        </button>
      </ModeBar>
    </>
  );
}
