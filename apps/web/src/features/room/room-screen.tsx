/**
 * One room from joining to its end: a short wait, the burning room (room-open-view.tsx), the ashes with the share
 * card (room-ashes.tsx), or a closed room. Refusals to get in, a lost session and leaving go back up to the panel.
 */
import { type ReactNode, useEffect } from 'react';
import type { RoomApi, RoomApiError } from './room-api';
import { RoomAshes } from './room-ashes';
import { useRoomText } from './room-messages';
import { RoomOpenView } from './room-open-view';
import { roomView } from './room-view-model';
import { useRoomSession } from './use-room-session';

interface RoomScreenProps {
  readonly code: string;
  readonly api: RoomApi;
  /** Back to the lobby, with the error that ended the room (null after leaving or for a closed room). */
  readonly onExit: (error: RoomApiError | null) => void;
}

export function RoomScreen({ code, api, onExit }: RoomScreenProps): ReactNode {
  const t = useRoomText();
  const { state, serverNow, actions } = useRoomSession(code, api);

  // Could not get in, or the session ended: the panel decides what to show instead.
  const exitError = state.phase === 'failed' ? state.error : state.phase === 'gone' && state.error?.kind === 'signed-out' ? state.error : null;
  useEffect(() => {
    if (exitError) onExit(exitError);
  }, [exitError, onExit]);

  const leave = async (): Promise<void> => {
    await actions.leave();
    onExit(null);
  };

  if (state.phase === 'joining' || state.phase === 'failed') {
    return (
      <p className="panel-line" role="status">
        {t('checking')}
      </p>
    );
  }

  const view = state.snapshot ? roomView(state.snapshot, serverNow) : null;
  const backButton = (
    <button type="button" className="btn-secondary" onClick={() => onExit(null)} data-id="room-back-lobby">
      {t('backToLobby')}
    </button>
  );

  if (state.phase === 'gone') {
    return (
      <>
        {state.snapshot && view?.status === 'ashes' ? <RoomAshes snapshot={state.snapshot} view={view} /> : <p className="panel-line">{t('gone')}</p>}
        <div className="room-actions">{backButton}</div>
      </>
    );
  }

  if (!view) return null;
  if (view.status === 'ashes') {
    return (
      <>
        <RoomAshes snapshot={state.snapshot} view={view} />
        <div className="room-actions">{backButton}</div>
      </>
    );
  }
  return (
    <>
      <RoomOpenView snapshot={state.snapshot} view={view} mode={state.mode} actions={actions} />
      <div className="room-actions">
        <button type="button" className="btn-secondary" onClick={() => void leave()} data-id="room-leave">
          {t('leave')}
        </button>
      </div>
    </>
  );
}
