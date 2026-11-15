/**
 * The room card's body for each step of the gate: checking the session, signed out (one Sign in link that comes back
 * here), offline (retry), an invite preview, the lobby, or the room itself.
 */
import type { ReactNode } from 'react';
import type { RoomApi, RoomApiError } from './room-api';
import type { MyStickSource } from './room-incense-timeline';
import { signInHref } from './room-invite';
import { RoomInvitePreview } from './room-invite-preview';
import { RoomLobby } from './room-lobby';
import { useRoomText } from './room-messages';
import { RoomScreen } from './room-screen';

export type Gate =
  | { readonly kind: 'checking' }
  | { readonly kind: 'signed-out'; readonly invite: string | null }
  | { readonly kind: 'offline' }
  | { readonly kind: 'lobby'; readonly notice: string }
  | { readonly kind: 'invite'; readonly code: string; readonly accountId: string | null }
  | { readonly kind: 'room'; readonly code: string; readonly accountId: string | null };

interface RoomGateViewProps {
  readonly gate: Gate;
  readonly api: RoomApi;
  retry(): void;
  enter(code: string): void;
  exit(error: RoomApiError | null): void;
  skipInvite(): void;
  onStick(source: MyStickSource): void;
  onLit(): void;
  onPlay(code: string): void;
}

export function RoomGateView({ gate, api, retry, enter, exit, skipInvite, onStick, onLit, onPlay }: RoomGateViewProps): ReactNode {
  const t = useRoomText();
  return (
    <>
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
            <a className="btn-primary room-link-button-solid" href={signInHref(gate.invite)} data-id="room-sign-in-link">
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
      {gate.kind === 'invite' && <RoomInvitePreview code={gate.code} onJoin={enter} onSkip={skipInvite} />}
      {gate.kind === 'lobby' && <RoomLobby api={api} notice={gate.notice} onEnter={enter} />}
      {gate.kind === 'room' && (
        <RoomScreen key={gate.code} code={gate.code} api={api} onExit={exit} onStick={onStick} onLit={onLit} onPlay={() => onPlay(gate.code)} />
      )}
    </>
  );
}
