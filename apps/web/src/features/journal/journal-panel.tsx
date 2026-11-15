/** Placeholder until the journal feature is built; the panel registry already points here. */
import type { ReactNode } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';

export function JournalPanel({ onBack }: PanelProps): ReactNode {
  return (
    <PanelFrame title="Sổ khẩu nghiệp" onBack={onBack} dataId="journal-panel">
      <p className="panel-note">…</p>
    </PanelFrame>
  );
}
