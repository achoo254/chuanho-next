/**
 * Before a room: make one (name, theme, how long the incense burns; 60 minutes unless changed) or join one by its
 * code. Both hand the code up once the server said yes; a refusal shows under the form it came from.
 */
import {
  DEFAULT_ROOM_BURN_MINUTES,
  ROOM_BURN_MINUTES,
  ROOM_NAME_MAX,
  ROOM_THEMES,
  type RoomBurnMinutes,
  type RoomTheme,
} from '@chuanho/contract';
import { type FormEvent, type ReactNode, useState } from 'react';
import type { RoomApi } from './room-api';
import { normaliseRoomCode } from './room-invite';
import { useRoomText } from './room-messages';
import { errorKey } from './room-view-model';

interface RoomLobbyProps {
  readonly api: RoomApi;
  /** A word from the panel (a room that could not be opened, or that closed). */
  readonly notice: string;
  readonly onEnter: (code: string) => void;
}

export function RoomLobby({ api, notice, onEnter }: RoomLobbyProps): ReactNode {
  const t = useRoomText();
  const [name, setName] = useState('');
  const [theme, setTheme] = useState<RoomTheme>('deadline');
  const [minutes, setMinutes] = useState<RoomBurnMinutes>(DEFAULT_ROOM_BURN_MINUTES);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const joinCode = normaliseRoomCode(code);

  const create = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy || name.trim() === '') return;
    setBusy(true);
    const result = await api.create({ name: name.trim(), theme, burnMinutes: minutes });
    setBusy(false);
    if (result.ok) onEnter(result.value.code);
    else setCreateError(t(errorKey(result.error)));
  };

  const join = (event: FormEvent): void => {
    event.preventDefault();
    if (joinCode) onEnter(joinCode);
    else setJoinError(t('error.room-not-found'));
  };

  return (
    <>
      {notice && (
        <p className="panel-line" role="alert">
          {notice}
        </p>
      )}
      <form className="room-section" onSubmit={(event) => void create(event)} data-id="room-create">
        <h3 className="room-section-title">{t('create.title')}</h3>
        <label className="room-field-label" htmlFor="room-create-name">
          {t('create.name')}
        </label>
        <input
          id="room-create-name"
          className="panel-field"
          value={name}
          maxLength={ROOM_NAME_MAX}
          placeholder={t('create.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
          data-id="room-create-name"
        />
        <p className="room-field-label" id="room-create-theme-label">
          {t('create.theme')}
        </p>
        <div className="panel-choices" role="group" aria-labelledby="room-create-theme-label">
          {ROOM_THEMES.map((id) => (
            <button key={id} type="button" className="panel-choice" aria-pressed={id === theme} onClick={() => setTheme(id)} data-id={`room-create-theme-${id}`}>
              {t(`theme.${id}`)}
            </button>
          ))}
        </div>
        <p className="room-field-label" id="room-create-minutes-label">
          {t('create.minutes')}
        </p>
        <div className="panel-choices" role="group" aria-labelledby="room-create-minutes-label">
          {ROOM_BURN_MINUTES.map((n) => (
            <button key={n} type="button" className="panel-choice" aria-pressed={n === minutes} onClick={() => setMinutes(n)} data-id={`room-create-minutes-${n}`}>
              {t('create.minutesValue', { n })}
            </button>
          ))}
        </div>
        <button type="submit" className="btn-primary" disabled={busy || name.trim() === ''} data-id="room-create-submit">
          {t('create.submit')}
        </button>
        <p className="panel-note" role="status" aria-live="polite">
          {createError}
        </p>
      </form>

      <form className="room-section" onSubmit={join} data-id="room-join">
        <h3 className="room-section-title">{t('join.title')}</h3>
        <label className="room-field-label" htmlFor="room-join-code">
          {t('join.code')}
        </label>
        <div className="room-composer-row">
          <input
            id="room-join-code"
            className="panel-field room-code-field"
            value={code}
            maxLength={12}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) => {
              setCode(event.target.value);
              setJoinError('');
            }}
            data-id="room-join-code"
          />
          <button type="submit" className="btn-secondary" disabled={!joinCode} data-id="room-join-submit">
            {t('join.submit')}
          </button>
        </div>
        <p className="panel-note" role="status" aria-live="polite">
          {joinError}
        </p>
      </form>
    </>
  );
}
