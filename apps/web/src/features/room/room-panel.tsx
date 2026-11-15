/** Placeholder until the room feature is built; the panel registry already points here. */
import type { ReactNode } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';

export function RoomPanel({ onBack }: PanelProps): ReactNode {
  return (
    <PanelFrame title="Phòng giải nghiệp" onBack={onBack} dataId="room-panel">
      <p className="panel-note">…</p>
    </PanelFrame>
  );
}
