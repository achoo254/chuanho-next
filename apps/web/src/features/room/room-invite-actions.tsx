/**
 * Inviting friends (copy the link, or the share sheet where there is one) and, for the host, locking the room. The
 * invite carries only the room's name and link.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { canShareText, copyText, shareText } from '../gentle/gentle-send';
import { inviteLink } from './room-invite';
import { useRoomText } from './room-messages';

const NOTICE_MS = 2200;

interface RoomInviteActionsProps {
  readonly code: string;
  readonly name: string;
  readonly isHost: boolean;
  readonly locked: boolean;
  readonly onLock: (locked: boolean) => void;
}

export function RoomInviteActions({ code, name, isHost, locked, onLock }: RoomInviteActionsProps): ReactNode {
  const t = useRoomText();
  const [notice, setNotice] = useState('');
  const [shareable] = useState(canShareText);
  const link = inviteLink(window.location.origin, code);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const copy = async (): Promise<void> => {
    setNotice((await copyText(link)) ? t('invite.copied') : t('invite.copyFailed'));
  };

  return (
    <div className="room-actions" data-id="room-invite">
      <button type="button" className="btn-secondary" onClick={() => void copy()} data-id="room-invite-copy">
        {t('invite.copy')}
      </button>
      {shareable && (
        <button type="button" className="btn-secondary" onClick={() => void shareText(`${t('invite.text', { name })} ${link}`)} data-id="room-invite-share">
          {t('invite.share')}
        </button>
      )}
      {isHost && (
        <button type="button" className="btn-secondary" aria-pressed={locked} onClick={() => onLock(!locked)} data-id="room-host-lock">
          {locked ? t('host.unlock') : t('host.lock')}
        </button>
      )}
      <p className="panel-note room-actions-notice" role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}
