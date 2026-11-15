/** Placeholder until the gentle feature is built; the panel registry already points here. */
import type { ReactNode } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';

export function GentlePanel({ onBack }: PanelProps): ReactNode {
  return (
    <PanelFrame title="Dịch sang tiếng hiền" onBack={onBack} dataId="gentle-panel">
      <p className="panel-note">…</p>
    </PanelFrame>
  );
}
