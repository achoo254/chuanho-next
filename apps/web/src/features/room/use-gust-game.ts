/**
 * One "Hộ hương" round in React: a ready screen, then the round clock on animation frames (gusts nobody shielded are
 * let through as their window closes), taps judged against the round time of the input event, and the end. The pure
 * rules live in gust-game-state.ts; this hook only owns time. The clock and the frame scheduler can be injected.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type GustEvent, type GustGameState, advanceGusts, initialGustGame, tapGust } from './gust-game-state';
import type { Gust, GustSide } from './gust-schedule';

export type GustPhase = 'ready' | 'playing' | 'done';

export interface GustClock {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
}

const browserClock: GustClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

interface GustGameOptions {
  readonly gusts: readonly Gust[];
  /** Every judged gust, as it happens (sound, 3D flame, floating words). */
  readonly onEvent: (event: GustEvent) => void;
  /** Once, when the round ends. */
  readonly onEnd: (state: GustGameState) => void;
  readonly clock?: GustClock;
}

export interface GustGame {
  readonly phase: GustPhase;
  readonly state: GustGameState;
  /** Round time now (ms since start), redrawn every frame while playing. */
  readonly elapsedMs: number;
  start(): void;
  /** A shield on `side`; `eventTimeMs` is the input event's time stamp on the clock's time base. */
  tap(side: GustSide, eventTimeMs?: number): void;
  /** Leaves the round without a result (back to the ready screen). */
  reset(): void;
}

export function useGustGame({ gusts, onEvent, onEnd, clock = browserClock }: GustGameOptions): GustGame {
  const [phase, setPhase] = useState<GustPhase>('ready');
  const [state, setState] = useState(() => initialGustGame(gusts.length));
  const [elapsedMs, setElapsedMs] = useState(0);
  const stateRef = useRef(state);
  const startedAt = useRef(0);
  const callbacks = useRef({ onEvent, onEnd });
  useEffect(() => {
    callbacks.current = { onEvent, onEnd };
  }, [onEvent, onEnd]);

  /** Applies a new state and reports its events; ends the round when the state says so. */
  const commit = useCallback((next: GustGameState, events: readonly GustEvent[]): void => {
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    for (const event of events) callbacks.current.onEvent(event);
    if (next.ended) {
      setPhase('done');
      callbacks.current.onEnd(next);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    let frame = 0;
    const step = (): void => {
      const now = clock.now() - startedAt.current;
      setElapsedMs(now);
      const { state: next, events } = advanceGusts(stateRef.current, gusts, now);
      commit(next, events);
      if (!next.ended) frame = clock.requestFrame(step);
    };
    frame = clock.requestFrame(step);
    return () => clock.cancelFrame(frame);
  }, [phase, gusts, clock, commit]);

  const start = useCallback((): void => {
    const fresh = initialGustGame(gusts.length);
    stateRef.current = fresh;
    setState(fresh);
    setElapsedMs(0);
    startedAt.current = clock.now();
    setPhase('playing');
  }, [gusts, clock]);

  const tap = useCallback(
    (side: GustSide, eventTimeMs?: number): void => {
      if (phase !== 'playing') return;
      // Input events can be stamped a moment before this runs; never judge a time before the round began.
      const at = Math.max(0, (eventTimeMs ?? clock.now()) - startedAt.current);
      const { state: next, event } = tapGust(stateRef.current, gusts, side, at);
      commit(next, event ? [event] : []);
    },
    [phase, gusts, clock, commit],
  );

  const reset = useCallback((): void => {
    const fresh = initialGustGame(gusts.length);
    stateRef.current = fresh;
    setState(fresh);
    setElapsedMs(0);
    setPhase('ready');
  }, [gusts]);

  return { phase, state, elapsedMs, start, tap, reset };
}
