/**
 * "Phòng giải nghiệp": the shared incense room. Checks the session first (signed out: one Sign in link that comes
 * back here, the yard stays playable), then the lobby or the room. An invite (`?room=CODE`) is read once and taken
 * off the address; it opens a preview with the code and a "join" button, never the room itself, so the player's
 * display name reaches the room only after they tap.
 *
 * The invite and the room belong to this panel and to the account that opened them: nothing is kept at module level,
 * and signing out or switching accounts drops both, so another account on the same page never inherits a room code.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '../../account/account-context';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';
import { type RoomApiError, roomApi } from './room-api';
import { signInHref, takeInviteCode } from './room-invite';
import { RoomInvitePreview } from './room-invite-preview';
import { RoomLobby } from './room-lobby';
import { useRoomText } from './room-messages';
import { RoomScreen } from './room-screen';
import { errorKey } from './room-view-model';
import './room.css';

const api = roomApi();

type Gate =
  | { readonly kind: 'checking' }
  | { readonly kind: 'signed-out'; readonly invite: string | null }
  | { readonly kind: 'offline' }
  | { readonly kind: 'lobby'; readonly notice: string }
  | { readonly kind: 'invite'; readonly code: string; readonly accountId: string | null }
  | { readonly kind: 'room'; readonly code: string; readonly accountId: string | null };

export function RoomPanel({ onBack }: PanelProps): ReactNode {
  const t = useRoomText();
  const accountId = useAccount().user?.id ?? null;
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);
  // The invite of this opening, kept across a retry (the address no longer has it).
  const invite = useRef<string | null>(null);
  const seenAccount = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    // Signing out or switching accounts drops the invite; the account finishing loading (null → id) does not.
    if (seenAccount.current !== null && seenAccount.current !== accountId) invite.current = null;
    seenAccount.current = accountId;
    invite.current = takeInviteCode() ?? invite.current;
    void api.me().then((result) => {
      if (!active) return;
      const code = invite.current;
      if (result.ok) setGate(code ? { kind: 'invite', code, accountId } : { kind: 'lobby', notice: '' });
      else setGate(result.error.kind === 'signed-out' ? { kind: 'signed-out', invite: code } : { kind: 'offline' });
    });
    return () => {
      active = false;
    };
  }, [attempt, accountId]);

  const enter = useCallback(
    (code: string) => {
      invite.current = null;
      setGate({ kind: 'room', code, accountId });
    },
    [accountId],
  );

  const exit = useCallback(
    (error: RoomApiError | null) => {
      if (error?.kind === 'signed-out') setGate({ kind: 'signed-out', invite: null });
      else setGate({ kind: 'lobby', notice: error ? t(errorKey(error)) : '' });
    },
    [t],
  );

  const skipInvite = useCallback(() => {
    invite.current = null;
    setGate({ kind: 'lobby', notice: '' });
  }, []);

  const retry = (): void => {
    setGate({ kind: 'checking' });
    setAttempt((count) => count + 1);
  };

  // A room or invite opened by another account (the session changed under the panel) is not shown while the check
  // for the new one runs.
  const stale = (gate.kind === 'room' || gate.kind === 'invite') && gate.accountId !== accountId;
  const shown: Gate = stale ? { kind: 'checking' } : gate;

  return (
    <PanelFrame title={t('title')} onBack={onBack} dataId="room-panel">
      {shown.kind !== 'room' && <p className="panel-note">{t('intro')}</p>}
      {shown.kind === 'checking' && (
        <p className="panel-line" role="status">
          {t('checking')}
        </p>
      )}
      {shown.kind === 'signed-out' && (
        <div className="room-section" data-id="room-sign-in">
          <p className="panel-line">{t('signInNeeded')}</p>
          <div className="room-actions">
            <a className="btn-primary room-link-button-solid" href={signInHref(shown.invite)} data-id="room-sign-in-link">
              {t('signIn')}
            </a>
          </div>
        </div>
      )}
      {shown.kind === 'offline' && (
        <div className="room-section" role="alert">
          <p className="panel-line">{t('offline')}</p>
          <div className="room-actions">
            <button type="button" className="btn-secondary" onClick={retry} data-id="room-retry">
              {t('retry')}
            </button>
          </div>
        </div>
      )}
      {shown.kind === 'invite' && <RoomInvitePreview code={shown.code} onJoin={enter} onSkip={skipInvite} />}
      {shown.kind === 'lobby' && <RoomLobby api={api} notice={shown.notice} onEnter={enter} />}
      {shown.kind === 'room' && <RoomScreen key={shown.code} code={shown.code} api={api} onExit={exit} />}
      <p className="panel-note">{t('privacy')}</p>
    </PanelFrame>
  );
}
