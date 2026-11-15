/**
 * The wind of "Hộ hương" on screen: each coming gust sweeps in from its edge as a ribbon of streaks with chevrons
 * pointing at the censer, and a ring closing on the moment it lands (the tap's timing cue), while that edge of the
 * screen glows. Drawn with CSS only, keyed per gust so each one plays its own animation; the round clock decides
 * which gusts are on screen. Screen readers hear the side in a live line.
 */
import type { CSSProperties, ReactNode } from 'react';
import { LATE_WINDOW_MS } from './gust-judge';
import { type Gust, type GustSide, TELEGRAPH_MS } from './gust-schedule';
import { useRoomGameText } from './room-game-messages';

const STREAKS = [0.18, 0.32, 0.46, 0.6, 0.74] as const;

interface WindProps {
  readonly gusts: readonly Gust[];
  readonly pending: (index: number) => boolean;
  readonly elapsedMs: number;
}

/** The gusts whose warning is showing at `elapsedMs` (from the telegraph until just after they land), still unjudged. */
function comingGusts(gusts: readonly Gust[], pending: (index: number) => boolean, elapsedMs: number): number[] {
  return gusts.flatMap((gust, index) =>
    pending(index) && elapsedMs >= gust.atMs - TELEGRAPH_MS && elapsedMs <= gust.atMs + LATE_WINDOW_MS ? [index] : [],
  );
}

export function RoomGameWind({ gusts, pending, elapsedMs }: WindProps): ReactNode {
  const text = useRoomGameText();
  const coming = comingGusts(gusts, pending, elapsedMs);
  const sides = new Set<GustSide>(coming.flatMap((index) => (gusts[index] ? [gusts[index].side] : [])));
  const first = gusts[coming[0] ?? -1];
  return (
    <>
      <div className={`room-wind-edge is-left${sides.has('left') ? ' is-on' : ''}`} aria-hidden="true" />
      <div className={`room-wind-edge is-right${sides.has('right') ? ' is-on' : ''}`} aria-hidden="true" />
      {coming.map((index) => {
        const gust = gusts[index];
        if (!gust) return null;
        // Started late (the round was paused by a slow frame): the animation catches up instead of starting over.
        const delay = -Math.max(0, Math.min(TELEGRAPH_MS, elapsedMs - (gust.atMs - TELEGRAPH_MS)));
        const timing = { '--wind-delay': `${delay}ms`, '--wind-ms': `${TELEGRAPH_MS}ms` } as CSSProperties;
        return (
          <div key={index} className={`room-wind is-${gust.side}`} style={timing} aria-hidden="true" data-id="room-wind">
            {STREAKS.map((top, n) => (
              <span key={top} className="room-wind-streak" style={{ top: `${top * 100}%`, animationDelay: `calc(var(--wind-delay) + ${n * 60}ms)` }} />
            ))}
            <span className="room-wind-chevrons">{gust.side === 'left' ? '›››' : '‹‹‹'}</span>
            <span className="room-wind-ring" />
          </div>
        );
      })}
      <p className="sr-only" aria-live="assertive">
        {first ? text(first.side === 'left' ? 'game.windLeft' : 'game.windRight') : ''}
      </p>
    </>
  );
}
