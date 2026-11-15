/**
 * Releasing one karma cloud (gỡ khẩu nghiệp): opens on the first step not done, saves each finished step at once
 * (closing midway loses nothing), moves past skipped ones, and ends on a small card: a blooming flower when all three
 * are done (the cloud dissolves in the list), or a calm "later" when some were skipped. Never a penalty, never a
 * promise of luck. Steps live in their own files; the order and rules are in release-steps.ts.
 */
import { type JournalEntry, type ReleaseStep, isReleased } from '@chuanho/contract';
import { type ReactNode, useCallback, useState } from 'react';
import type { PlayModeProps } from '../../modes/mode-chrome';
import { PanelFrame } from '../panel-frame';
import { completeReleaseStep } from './journal-logic';
import { BloomFlower } from './journal-icons';
import { useJournalText } from './journal-messages';
import { journalStore } from './journal-store';
import { ReleaseApologyStep } from './release-apology-step';
import { ReleaseDeedStep } from './release-deed-step';
import { ReleaseResetStep } from './release-reset-step';
import { firstOpenStep, nextOpenStep } from './release-steps';

interface ReleaseFlowProps extends Pick<PlayModeProps, 'stage' | 'registerStrike'> {
  /** The entry as it is in the store now (re-rendered as steps are saved). */
  readonly entry: JournalEntry;
  onClose(): void;
}

export function ReleaseFlow({ entry, stage, registerStrike, onClose }: ReleaseFlowProps): ReactNode {
  const [step, setStep] = useState<ReleaseStep | null>(() => firstOpenStep(entry));
  const { id } = entry;

  const finish = useCallback(
    (done: ReleaseStep): void => {
      journalStore.update(id, (current, now) => completeReleaseStep(current, done, now));
      // Only the steps after `done` matter here, so the entry as rendered is enough. A late call (the reset step's
      // timer after the player already moved on) leaves the screen where it is.
      setStep((shown) => (shown === done ? nextOpenStep(entry, done) : shown));
    },
    [id, entry],
  );
  const skip = (skipped: ReleaseStep): void => setStep(nextOpenStep(entry, skipped));
  const finishReset = useCallback((): void => finish('reset'), [finish]);

  switch (step) {
    case 'reset':
      return <ReleaseResetStep stage={stage} registerStrike={registerStrike} onDone={finishReset} onSkip={() => skip('reset')} onClose={onClose} />;
    case 'apology':
      return <ReleaseApologyStep kind={entry.kind} onDone={() => finish('apology')} onSkip={() => skip('apology')} onClose={onClose} />;
    case 'deed':
      return <ReleaseDeedStep onDone={() => finish('deed')} onSkip={() => skip('deed')} onClose={onClose} />;
    default:
      return <ReleaseEndCard released={isReleased(entry)} onClose={onClose} />;
  }
}

function ReleaseEndCard({ released, onClose }: { readonly released: boolean; onClose(): void }): ReactNode {
  const text = useJournalText();
  return (
    <PanelFrame
      title={released ? text('bloom.title') : text('later.title')}
      onBack={onClose}
      dataId="release-end"
      footer={
        <button type="button" className="btn-primary" data-id="release-end-back" onClick={onClose}>
          {text('back')}
        </button>
      }
    >
      <div className="release-end" role="status">
        {released && <BloomFlower />}
        <p className="panel-line">{released ? text('bloom.line') : text('later.line')}</p>
      </div>
    </PanelFrame>
  );
}
