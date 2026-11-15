/**
 * The two calm cards of "Hộ hương": the rules before a round and the result after it (stars, calm score, shields,
 * the best round on this device). Both reuse the compact play card of the 3D modes.
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { HudIcon } from '../../hud/hud-icons';
import { type GustGameState, starsFor } from './gust-game-state';
import type { RoomGameRecord } from './room-game-best';
import { useRoomGameText } from './room-game-messages';

interface ReadyCardProps {
  readonly practice: boolean;
  readonly record: RoomGameRecord;
  onStart(): void;
  onBack(): void;
}

export function RoomGameReadyCard({ practice, record, onStart, onBack }: ReadyCardProps): ReactNode {
  const text = useRoomGameText();
  const start = useRef<HTMLButtonElement>(null);
  // The card opens over a full-screen game: put the keyboard on its main action.
  useEffect(() => start.current?.focus(), []);
  return (
    <div className="play-card room-game-card" role="dialog" aria-labelledby="room-game-ready-title" data-id="room-game-ready">
      <p className="play-card-title" id="room-game-ready-title">
        {text('game.title')}
      </p>
      <p className="play-card-line">{text('game.rules')}</p>
      <p className="play-card-note">{text('game.rulesNote')}</p>
      {practice && <p className="play-card-note">{text('game.practice')}</p>}
      {record.bestScore > 0 && <p className="play-card-note">{text('result.best', { n: record.bestScore })}</p>}
      <div className="play-card-actions">
        <button type="button" className="btn-secondary" onClick={onBack} data-id="room-game-ready-back">
          {text('result.back')}
        </button>
        <button ref={start} type="button" className="btn-primary play-btn-icon" onClick={onStart} data-id="room-game-start">
          <HudIcon name="play" size={20} />
          {text('game.start')}
        </button>
      </div>
    </div>
  );
}

interface ResultCardProps {
  readonly state: GustGameState;
  readonly total: number;
  readonly record: RoomGameRecord;
  readonly newBest: boolean;
  onAgain(): void;
  onBack(): void;
}

export function RoomGameResultCard({ state, total, record, newBest, onAgain, onBack }: ResultCardProps): ReactNode {
  const text = useRoomGameText();
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus(), []);
  const stars = starsFor(state);
  const complete = state.ended === 'complete';
  return (
    <div className="play-card room-game-card" role="dialog" aria-labelledby="room-game-result-title" data-id="room-game-result">
      <p className="play-card-title" id="room-game-result-title">
        {text(complete ? 'result.complete' : 'result.flameLow')}
      </p>
      {!complete && <p className="play-card-note">{text('result.flameLowNote')}</p>}
      <p className="room-game-stars" role="img" aria-label={text('result.stars', { n: stars })}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`room-game-star${n <= stars ? ' is-on' : ''}`} style={{ animationDelay: `${n * 160}ms` }}>
            <HudIcon name="merit" size={34} />
          </span>
        ))}
      </p>
      <p className="play-card-line">{text('result.score', { n: state.score })}</p>
      <p className="play-card-note">
        {text('result.shields', { n: state.perfects + state.goods, total })} · {text('result.combo', { n: state.bestCombo })}
      </p>
      <p className="play-card-note" data-id="room-game-best">
        {newBest ? text('result.newBest') : text('result.best', { n: record.bestScore })}
      </p>
      <div className="play-card-actions">
        <button type="button" className="btn-secondary" onClick={onBack} data-id="room-game-back">
          {text('result.back')}
        </button>
        <button ref={again} type="button" className="btn-primary" onClick={onAgain} data-id="room-game-again">
          {text('result.again')}
        </button>
      </div>
    </div>
  );
}
