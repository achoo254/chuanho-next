/**
 * "Phòng giải nghiệp": the shared incense room. Checks the session first (signed out: one Sign in link that comes
 * back here, the yard stays playable), then the lobby or the room. An invite (`?room=CODE`) is read once and taken
 * off the address; the room this device is in is remembered while the page lives, so closing and reopening the
 * panel goes back into it.
 */
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';
import { type RoomApiError, roomApi } from './room-api';
import { signInHref, takeInviteCode } from './room-invite';
import { RoomLobby } from './room-lobby';
import { useRoomText } from './room-messages';
import { RoomScreen } from './room-screen';
import { errorKey } from './room-view-model';
import './room.css';

const api = roomApi();

/** The room this page is in, across openings of the panel (null in the lobby). */
const current: { code: string | null } = { code: null };

type Gate =
  | { readonly kind: 'checking' }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'lobby'; readonly notice: string }
  | { readonly kind: 'room'; readonly code: string };

export function RoomPanel({ onBack }: PanelProps): ReactNode {
  const t = useRoomText();
  const [gate, setGate] = useState<Gate>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    current.code = takeInviteCode() ?? current.code;
    void api.me().then((result) => {
      if (!active) return;
      if (result.ok) setGate(current.code ? { kind: 'room', code: current.code } : { kind: 'lobby', notice: '' });
      else setGate(result.error.kind === 'signed-out' ? { kind: 'signed-out' } : { kind: 'offline' });
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const enter = useCallback((code: string) => {
    current.code = code;
    setGate({ kind: 'room', code });
  }, []);

  const exit = useCallback(
    (error: RoomApiError | null) => {
      current.code = null;
      if (error?.kind === 'signed-out') setGate({ kind: 'signed-out' });
      else setGate({ kind: 'lobby', notice: error ? t(errorKey(error)) : '' });
    },
    [t],
  );

  const retry = (): void => {
    setGate({ kind: 'checking' });
    setAttempt((count) => count + 1);
  };

  return (
    <PanelFrame title={t('title')} onBack={onBack} dataId="room-panel">
      {gate.kind !== 'room' && <p className="panel-note">{t('intro')}</p>}
      {gate.kind === 'checking' && (
        <p className="panel-line" role="status">
          {t('checking')}
        </p>
      )}
      {gate.kind === 'signed-out' && (
        <div className="room-section" data-id="room-sign-in">
          <p className="panel-line">{t('signInNeeded')}</p>
          <div className="room-actions">
            <a className="btn-primary room-link-button-solid" href={signInHref(current.code)} data-id="room-sign-in-link">
              {t('signIn')}
            </a>
          </div>
        </div>
      )}
      {gate.kind === 'offline' && (
        <div className="room-section" role="alert">
          <p className="panel-line">{t('offline')}</p>
          <div className="room-actions">
            <button type="button" className="btn-secondary" onClick={retry} data-id="room-retry">
              {t('retry')}
            </button>
          </div>
        </div>
      )}
      {gate.kind === 'lobby' && <RoomLobby api={api} notice={gate.notice} onEnter={enter} />}
      {gate.kind === 'room' && <RoomScreen key={gate.code} code={gate.code} api={api} onExit={exit} />}
      <p className="panel-note">{t('privacy')}</p>
    </PanelFrame>
  );
}
