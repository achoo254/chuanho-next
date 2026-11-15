/**
 * Writing a wish: one short line with a live counter and the filter's verdict as you type (the same `checkWish` the
 * server applies), quick suggestions for the room's theme that fill the box, and the server's answer once sent.
 */
import type { RoomTheme } from '@chuanho/contract';
import { type FormEvent, type ReactNode, useState } from 'react';
import type { RoomApiError } from './room-api';
import { useRoomText } from './room-messages';
import { errorKey, wishFeedback } from './room-view-model';
import { ROOM_WISH_SUGGESTIONS } from './room-wish-suggestions';

interface RoomWishComposerProps {
  readonly theme: RoomTheme;
  readonly onSend: (text: string) => Promise<RoomApiError | null>;
}

export function RoomWishComposer({ theme, onSend }: RoomWishComposerProps): ReactNode {
  const t = useRoomText();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const feedback = wishFeedback(text);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!feedback.sendable || sending) return;
    setSending(true);
    const error = await onSend(text);
    setSending(false);
    if (error) setNotice(t(errorKey(error)));
    else {
      setText('');
      setNotice('');
    }
  };

  return (
    <form className="room-composer" onSubmit={(event) => void submit(event)} data-id="room-wish-form">
      <label className="room-section-title" htmlFor="room-wish-input">
        {t('wish.label')}
      </label>
      <div className="room-composer-row">
        <input
          id="room-wish-input"
          className="panel-field"
          value={text}
          maxLength={feedback.max + 20}
          placeholder={t('wish.placeholder')}
          autoComplete="off"
          aria-invalid={feedback.reasonKey !== null}
          aria-describedby="room-wish-feedback"
          onChange={(event) => {
            setText(event.target.value);
            setNotice('');
          }}
          data-id="room-wish-input"
        />
        <button type="submit" className="btn-primary" disabled={!feedback.sendable || sending} data-id="room-wish-send">
          {t('wish.send')}
        </button>
      </div>
      <p className="panel-note room-composer-feedback" id="room-wish-feedback" role="status" aria-live="polite">
        <span>{notice || (feedback.reasonKey ? t(feedback.reasonKey) : '')}</span>
        <span className={feedback.length > feedback.max ? 'room-over' : undefined}>{t('wish.counter', { n: feedback.length, max: feedback.max })}</span>
      </p>
      <p className="room-section-title" id="room-suggestions-label">
        {t('wish.suggestions')}
      </p>
      <div className="panel-choices room-suggestions" role="group" aria-labelledby="room-suggestions-label">
        {ROOM_WISH_SUGGESTIONS[theme].map((line, index) => (
          <button
            key={line}
            type="button"
            className="panel-choice room-suggestion"
            onClick={() => {
              setText(line);
              setNotice('');
            }}
            data-id={`room-suggestion-${index}`}
          >
            {line}
          </button>
        ))}
      </div>
    </form>
  );
}
