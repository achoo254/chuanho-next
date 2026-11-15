/** Placeholder until the fortune feature is built; the panel registry already points here. */
import type { ReactNode } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';

export function FortunePanel({ onBack }: PanelProps): ReactNode {
  return (
    <PanelFrame title="Xin xăm" onBack={onBack} dataId="fortune-panel">
      <p className="panel-note">…</p>
    </PanelFrame>
  );
}
