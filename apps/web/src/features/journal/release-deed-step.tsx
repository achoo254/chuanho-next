/**
 * Release step 3: one kind deed in real life. Built-in ideas only (any kind deed counts); the player taps "done"
 * when they did it. Nothing is checked and nothing is forced.
 */
import type { ReactNode } from 'react';
import { DEED_KEYS, useJournalText } from './journal-messages';
import { ReleaseStepFrame } from './release-step-frame';

interface DeedStepProps {
  onDone(): void;
  onSkip(): void;
  onClose(): void;
}

export function ReleaseDeedStep({ onDone, onSkip, onClose }: DeedStepProps): ReactNode {
  const text = useJournalText();
  return (
    <ReleaseStepFrame step={3} title={text('deed.title')} doneLabel={text('deed.done')} dataId="release-deed" onDone={onDone} onSkip={onSkip} onClose={onClose}>
      <p className="panel-note">{text('deed.hint')}</p>
      <ul className="panel-list" data-id="release-deed-ideas">
        {DEED_KEYS.map((key) => (
          <li key={key} className="panel-list-item">
            {text(key)}
          </li>
        ))}
      </ul>
    </ReleaseStepFrame>
  );
}
