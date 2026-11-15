/**
 * The room card's body in the minigame preview (`?play=room-game`): no server, no sign-in, just "Hộ hương" as
 * practice and the light-up cutscene on demand, so both can be checked on any device. Nothing is sent anywhere.
 */
import type { ReactNode } from 'react';
import { HudIcon } from '../../hud/hud-icons';
import { useRoomGameText } from './room-game-messages';

interface RoomDemoSectionProps {
  onPlay(): void;
  onLight(): void;
}

export function RoomDemoSection({ onPlay, onLight }: RoomDemoSectionProps): ReactNode {
  const text = useRoomGameText();
  return (
    <div className="room-section" data-id="room-demo">
      <p className="room-section-title">{text('demo.title')}</p>
      <p className="panel-note">{text('demo.note')}</p>
      <div className="room-actions">
        <button type="button" className="btn-secondary" onClick={onLight} data-id="room-demo-light">
          {text('demo.light')}
        </button>
        <button type="button" className="btn-primary play-btn-icon" onClick={onPlay} data-id="room-demo-play">
          <HudIcon name="combo" size={20} />
          {text('play')}
        </button>
      </div>
    </div>
  );
}
