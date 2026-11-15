/** Placeholder until the radio feature is built; the panel registry already points here. */
import type { ReactNode } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';

export function RadioPanel({ onBack }: PanelProps): ReactNode {
  return (
    <PanelFrame title="Đài" onBack={onBack} dataId="radio-panel">
      <p className="panel-note">…</p>
    </PanelFrame>
  );
}
