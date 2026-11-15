/**
 * Where an invite link lands: the room's code and a "join" button, nothing more. Opening the link never joins by
 * itself, so the player's display name reaches the room only after they tap; "back to the lobby" leaves the invite.
 */
import type { ReactNode } from 'react';
import { useRoomText } from './room-messages';

interface RoomInvitePreviewProps {
  readonly code: string;
  readonly onJoin: (code: string) => void;
  readonly onSkip: () => void;
}

export function RoomInvitePreview({ code, onJoin, onSkip }: RoomInvitePreviewProps): ReactNode {
  const t = useRoomText();
  return (
    <div className="room-section" data-id="room-invite-preview">
      <h3 className="room-section-title">{t('join.title')}</h3>
      <p className="panel-line" data-id="room-invite-preview-code">
        {t('code', { code })}
      </p>
      <div className="room-actions">
        <button type="button" className="btn-primary" onClick={() => onJoin(code)} data-id="room-invite-preview-join">
          {t('join.submit')}
        </button>
        <button type="button" className="btn-secondary" onClick={onSkip} data-id="room-invite-preview-skip">
          {t('backToLobby')}
        </button>
      </div>
    </div>
  );
}
