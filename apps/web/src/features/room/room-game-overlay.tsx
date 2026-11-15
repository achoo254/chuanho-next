/**
 * "Hộ hương" (guard the incense), full screen over the 3D yard with the censer still in view: gusts sweep in from the
 * left or right (room-game-wind.tsx) and a tap on that half of the screen (or ← →) shields the flame. PERFECT and
 * GOOD pop up like in Mõ Beat, the 3D ember flares on a shield and flickers dim when a gust gets through, the character
 * reacts. Esc and the back button leave the overlay only, never the room.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buzz, playSample } from '../../audio/audio-engine';
import { HudIcon } from '../../hud/hud-icons';
import { useBeatJudgement } from '../../modes/beat-judgement';
import { ModeBar } from '../../modes/mode-chrome';
import type { PlayStage } from '../../modes/play-stage';
import { FLAME_POINTS, type GustEvent, type GustGameState, starsFor } from './gust-game-state';
import { type GustSide, buildGustSchedule } from './gust-schedule';
import { type RoomGameRecord, readRoomGameRecord, saveRoomGameRound } from './room-game-best';
import { RoomGameReadyCard, RoomGameResultCard } from './room-game-cards';
import { useRoomGameText } from './room-game-messages';
import { RoomGameWind } from './room-game-wind';
import { type FlameReaction, applyIncenseLook, gameLook } from './room-incense-timeline';
import { useGustGame } from './use-gust-game';
import './room-game.css';

const JUDGE_ART = { perfect: '/art/beat/judge-perfect.webp', good: '/art/beat/judge-good.webp', miss: '/art/beat/judge-miss.webp' } as const;

interface RoomGameOverlayProps {
  readonly stage: PlayStage;
  readonly seed: number;
  /** No burning stick of the player's own: the round is practice (same wind, same scoring). */
  readonly practice: boolean;
  readonly baseBurn: () => number;
  onClose(): void;
}

export function RoomGameOverlay({ stage, seed, practice, baseBurn, onClose }: RoomGameOverlayProps): ReactNode {
  const text = useRoomGameText();
  const gusts = useMemo(() => buildGustSchedule(seed), [seed]);
  const judgement = useBeatJudgement();
  const showJudgement = judgement.show;
  const [record, setRecord] = useState<RoomGameRecord>(readRoomGameRecord);
  const [newBest, setNewBest] = useState(false);
  const [flash, setFlash] = useState<{ id: number; side: GustSide; kind: 'shield' | 'gust' } | null>(null);
  const reaction = useRef<{ kind: FlameReaction; at: number }>({ kind: 'none', at: 0 });
  const flame = useRef(FLAME_POINTS);

  const onEvent = useCallback(
    (event: GustEvent): void => {
      const side = gusts[event.index]?.side ?? 'left';
      reaction.current = { kind: event.kind === 'shield' ? 'shielded' : 'gusted', at: performance.now() };
      setFlash((previous) => ({ id: (previous?.id ?? 0) + 1, side, kind: event.kind === 'shield' ? 'shield' : 'gust' }));
      if (event.kind === 'shield') {
        showJudgement(event.grade, text(event.grade === 'perfect' ? 'judge.perfect' : 'judge.good'));
        playSample(event.grade === 'perfect' ? 'bell' : 'mo', { gain: event.grade === 'perfect' ? 0.45 : 0.6 });
        buzz(event.grade === 'perfect' ? 18 : 10);
        if (event.grade === 'perfect') stage.flashFace('perfect', 380);
        return;
      }
      showJudgement(event.reason === 'wrong-side' ? 'mash' : 'miss', text(event.reason === 'wrong-side' ? 'judge.wrong' : 'judge.miss'));
      playSample('bowl', { gain: 0.3 });
      buzz([8, 40, 8]);
      stage.flashFace('surprised', 520);
    },
    [gusts, showJudgement, text, stage],
  );

  const onEnd = useCallback(
    (final: GustGameState): void => {
      const saved = saveRoomGameRound(final.score, starsFor(final));
      setRecord(saved.record);
      setNewBest(saved.newBest);
      playSample(final.ended === 'complete' ? 'bell' : 'bowl', { gain: 0.6 });
      stage.flashFace(final.ended === 'complete' ? 'happy' : 'calm', 1600);
    },
    [stage],
  );

  const game = useGustGame({ gusts, onEvent, onEnd });
  useEffect(() => {
    flame.current = game.state.flame;
  }, [game.state.flame]);

  // The 3D flame follows the round on every frame: the real (or practice) burn, flaring and flickering.
  useEffect(() => {
    let frame = 0;
    const draw = (): void => {
      applyIncenseLook(stage, gameLook(baseBurn(), flame.current, reaction.current.kind, performance.now() - reaction.current.at));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [stage, baseBurn]);

  // Keys of the round: ← → shield, Esc leaves the overlay (and is kept from closing the whole room).
  const { tap } = game;
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const side: GustSide | null = event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : null;
      if (event.key !== 'Escape' && !side) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (side) {
        if (!event.repeat) tap(side, event.timeStamp);
      } else onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [tap, onClose]);

  const playing = game.phase === 'playing';
  const { state } = game;
  const half = (side: GustSide): ReactNode => (
    <button
      type="button"
      className={`room-game-half is-${side}`}
      aria-label={text(side === 'left' ? 'game.left' : 'game.right')}
      data-id={`room-game-${side}`}
      onPointerDown={(event) => {
        if (event.button <= 0) tap(side, event.timeStamp);
      }}
      // Keyboard "clicks" only (detail 0): a pointer already shielded on pointerdown.
      onClick={(event) => {
        if (event.detail === 0) tap(side);
      }}
      onContextMenu={(event) => event.preventDefault()}
    />
  );

  return (
    <div className="room-game" data-id="room-game" data-phase={game.phase}>
      {playing && (
        <>
          {half('left')}
          {half('right')}
          <RoomGameWind gusts={gusts} pending={(index) => state.marks[index] === 'pending'} elapsedMs={game.elapsedMs} />
        </>
      )}
      {flash && <span key={flash.id} className={`room-game-flash is-${flash.side} is-${flash.kind}`} aria-hidden="true" />}
      <div className="beat-judge-anchor room-game-judge" aria-hidden="true">
        {judgement.current && (
          <div key={judgement.current.id} className={`beat-judge beat-judge-${judgement.current.kind}`}>
            <img className="beat-judge-art" src={JUDGE_ART[judgement.current.kind === 'mash' ? 'miss' : judgement.current.kind]} alt="" draggable={false} />
            <span className="beat-judge-word">{judgement.current.text}</span>
          </div>
        )}
      </div>
      {playing && (
        <div className="room-game-hud" data-id="room-game-hud">
          <span className="play-chip room-game-flames" role="img" aria-label={text('game.flame', { n: state.flame, max: FLAME_POINTS })}>
            {Array.from({ length: FLAME_POINTS }, (_, n) => (
              <span key={n} className={`room-game-flame${n < state.flame ? ' is-lit' : ''}`}>
                <HudIcon name="combo" size={18} />
              </span>
            ))}
          </span>
          {state.combo > 1 && (
            <span key={state.combo} className="play-chip room-game-combo">
              {text('game.combo', { n: state.combo })}
            </span>
          )}
          <span className="play-chip">{text('game.score', { n: state.score })}</span>
        </div>
      )}
      <ModeBar onBack={onClose} />
      {game.phase === 'ready' && <RoomGameReadyCard practice={practice} record={record} onStart={game.start} onBack={onClose} />}
      {game.phase === 'done' && (
        <RoomGameResultCard state={state} total={gusts.length} record={record} newBest={newBest} onAgain={game.start} onBack={onClose} />
      )}
    </div>
  );
}
