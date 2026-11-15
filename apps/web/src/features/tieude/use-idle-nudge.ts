/**
 * React side of the idle-nudge rhythm (idle-nudge-controller.ts): returns what is on screen now (whatever `next()`
 * made for this nudge, or null) and a dismiss function. `next` and `allowed` are always the latest given (so they can
 * read fresh state); the timings are read once per mount; `timers` defaults to the window's.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type IdleNudgeController, type IdleNudgeOptions, type NudgeTimers, createIdleNudgeController } from './idle-nudge-controller';

const WINDOW_TIMERS: NudgeTimers = {
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

export interface IdleNudgeSetup<T> extends Omit<IdleNudgeOptions, 'allowed'> {
  /** Makes the content of the n-th nudge (counted from 1); null shows nothing this time. */
  readonly next: (count: number) => T | null;
  readonly allowed?: () => boolean;
}

export interface IdleNudge<T> {
  readonly current: T | null;
  dismiss(): void;
}

export function useIdleNudge<T>(idle: boolean, setup: IdleNudgeSetup<T>, timers: NudgeTimers = WINDOW_TIMERS): IdleNudge<T> {
  const [current, setCurrent] = useState<T | null>(null);
  const controllerRef = useRef<IdleNudgeController | null>(null);
  const latest = useRef(setup);
  const clock = useRef(timers);
  useEffect(() => {
    latest.current = setup;
  });

  useEffect(() => {
    const { firstDelayMs, gapMs, showMs, random } = latest.current;
    const controller = createIdleNudgeController(
      { firstDelayMs, gapMs, showMs, random, allowed: () => latest.current.allowed?.() ?? true },
      clock.current,
      (count) => setCurrent(latest.current.next(count)),
      () => setCurrent(null),
    );
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setIdle(idle);
  }, [idle]);

  const dismiss = useCallback((): void => controllerRef.current?.dismiss(), []);
  return { current, dismiss };
}
