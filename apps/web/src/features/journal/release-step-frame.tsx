/**
 * The card of a release step that is read rather than struck (apology, deed): the panel frame with the step number,
 * the honest line (real actions, not a charm), the step's body, and "skip" next to the step's own "done" button.
 * Back closes the flow; finished steps stay done.
 */
import type { ReactNode } from 'react';
import { PanelFrame } from '../panel-frame';
import { useJournalText } from './journal-messages';

interface ReleaseStepFrameProps {
  readonly step: number;
  readonly title: string;
  readonly doneLabel: string;
  readonly dataId: string;
  onDone(): void;
  onSkip(): void;
  onClose(): void;
  readonly children: ReactNode;
}

export function ReleaseStepFrame({ step, title, doneLabel, dataId, onDone, onSkip, onClose, children }: ReleaseStepFrameProps): ReactNode {
  const text = useJournalText();
  return (
    <PanelFrame
      title={title}
      onBack={onClose}
      dataId={dataId}
      bar={<span className="play-chip">{text('release.stepOf', { n: step })}</span>}
      footer={
        <>
          <button type="button" className="btn-secondary" data-id={`${dataId}-skip`} onClick={onSkip}>
            {text('release.skip')}
          </button>
          <button type="button" className="btn-primary" data-id={`${dataId}-done`} onClick={onDone}>
            {doneLabel}
          </button>
        </>
      }
    >
      <p className="panel-note">{text('release.honest')}</p>
      {children}
    </PanelFrame>
  );
}
