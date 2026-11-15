/**
 * The words over the "light my stick" cutscene: the card steps aside, the letterbox closes in, and "+1" rises over
 * the censer while the 3D sticks catch (use-room-incense.ts). Purely visual and short; it never takes a tap.
 */
import type { ReactNode } from 'react';
import { useRoomGameText } from './room-game-messages';

export function RoomLightUpCue(): ReactNode {
  const text = useRoomGameText();
  return (
    <div className="room-light-cue" data-id="room-light-cue" aria-hidden="true">
      <span className="room-intro-bar room-intro-bar-top" />
      <span className="room-intro-bar room-intro-bar-bottom" />
      <span className="room-light-cue-plus">{text('lit.float')}</span>
    </div>
  );
}
