/**
 * The room while its incense burns: name, theme, code and live state on top, the shared burner with the countdown
 * and "light my stick" (the panel then plays the light-up in the 3D censer), the "Hộ hương" minigame while the
 * player's stick burns, the invite and host controls, the wish box, the wishes and the people. Every action reports
 * its refusal in one status line.
 */
import type { RoomSnapshot } from '@chuanho/contract';
import { type ReactNode, useState } from 'react';
import { HudIcon } from '../../hud/hud-icons';
import type { RoomApiError } from './room-api';
import { RoomCenser } from './room-censer';
import { useRoomGameText } from './room-game-messages';
import { RoomInviteActions } from './room-invite-actions';
import type { LiveMode } from './room-live';
import { RoomMembers } from './room-members';
import { useRoomText } from './room-messages';
import { type RoomView, errorKey } from './room-view-model';
import { RoomWishComposer } from './room-wish-composer';
import { RoomWishList } from './room-wish-list';
import type { RoomActions } from './use-room-session';

interface RoomOpenViewProps {
  readonly snapshot: RoomSnapshot;
  readonly view: RoomView;
  readonly mode: LiveMode;
  readonly actions: RoomActions;
  readonly onLit: () => void;
  readonly onPlay: () => void;
}

export function RoomOpenView({ snapshot, view, mode, actions, onLit, onPlay }: RoomOpenViewProps): ReactNode {
  const t = useRoomText();
  const game = useRoomGameText();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [justLit, setJustLit] = useState(false);
  const burning = view.me?.stick ? !view.me.stick.burntOut : false;

  const light = async (): Promise<void> => {
    setBusy(true);
    const error = await actions.light();
    setBusy(false);
    setNotice(error ? t(errorKey(error)) : '');
    if (error) return;
    setJustLit(true);
    onLit();
  };

  /** Runs an action and says why it was refused, if it was. */
  const perform = async (action: () => Promise<RoomApiError | null>): Promise<void> => {
    setBusy(true);
    const error = await action();
    setBusy(false);
    setNotice(error ? t(errorKey(error)) : '');
  };

  return (
    <>
      <div className="room-heading">
        <span className="room-chip">{t(`theme.${snapshot.theme}`)}</span>
        <span className="room-chip" data-id="room-code">
          {t('code', { code: snapshot.code })}
        </span>
        {snapshot.locked && <span className="room-chip">{t('locked')}</span>}
        <span className={`room-live room-live-${mode}`} role="status">
          {t(`live.${mode === 'connecting' ? 'reconnecting' : mode}`)}
        </span>
      </div>
      <p className="panel-line room-name">{snapshot.name}</p>

      <RoomCenser members={view.members} smoke={view.smoke} milestone={view.milestone} ashes={false} label={t('censerLabel', { n: view.burning })} />
      <p className="panel-line room-countdown" data-id="room-countdown">
        {view.minutesLeft === null ? t('notLit') : t('minutesLeft', { n: view.minutesLeft })}
      </p>
      <p className="panel-note room-counts">
        {t('litCount', { n: snapshot.litTotal })}
        {view.milestone > 0 && ` · ${t('milestone', { n: view.milestone })}`}
      </p>
      <div className="room-actions">
        {view.canLight ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void light()} data-id="room-light">
            {t('light')}
          </button>
        ) : (
          view.me?.stick && <p className="panel-note">{t('lit')}</p>
        )}
      </div>
      {burning && (
        <div className="room-actions room-play-row">
          {justLit && <p className="panel-line room-actions-notice">{game('lit.offer')}</p>}
          <button type="button" className={`btn-primary play-btn-icon${justLit ? ' room-play-invite' : ''}`} onClick={onPlay} data-id="room-play-game">
            <HudIcon name="combo" size={20} />
            {game('play')}
          </button>
        </div>
      )}
      <p className="panel-note" role="status" aria-live="polite" data-id="room-notice">
        {notice}
      </p>

      <RoomInviteActions
        code={snapshot.code}
        name={snapshot.name}
        isHost={view.isHost}
        locked={snapshot.locked}
        onLock={(locked) => void perform(() => actions.setLocked(locked))}
      />
      <RoomWishComposer theme={snapshot.theme} onSend={actions.wish} />
      <RoomWishList
        wishes={view.wishes}
        onDelete={(wishId) => void perform(() => actions.deleteWish(wishId))}
        onReport={(wishId) => void perform(() => actions.report(wishId))}
      />
      <RoomMembers members={view.members} />
    </>
  );
}
