/**
 * The sleep timer as pure functions of a clock reading (milliseconds, injected by the caller): how long is left,
 * how far the slow fade-out has gone, and whether the music should now stop. The fade covers the last stretch of
 * the timer, so the music gets quieter while the listener drifts off instead of cutting out.
 */

export interface SleepTimer {
  readonly startedAtMs: number;
  /** Null: no end ("until I stop"). */
  readonly durationMs: number | null;
}

export interface SleepTimerStatus {
  /** Milliseconds until the music stops, or null without an end. */
  readonly remainingMs: number | null;
  /** 0 before the fade starts, rising to 1 when the timer ends. */
  readonly fadeProgress: number;
  readonly done: boolean;
}

/** The longest fade-out; shorter timers fade over their last third. */
export const MAX_SLEEP_FADE_MS = 5 * 60_000;

/** Starts a timer of `minutes` at `nowMs`; null, zero, negative or non-finite minutes mean "until I stop". */
export function startSleepTimer(nowMs: number, minutes: number | null): SleepTimer {
  const valid = minutes !== null && Number.isFinite(minutes) && minutes > 0;
  return { startedAtMs: nowMs, durationMs: valid ? minutes * 60_000 : null };
}

/** How long the fade-out of a timer of `durationMs` lasts. */
export function sleepFadeMs(durationMs: number): number {
  return Math.min(MAX_SLEEP_FADE_MS, durationMs / 3);
}

export function sleepTimerStatus(timer: SleepTimer, nowMs: number): SleepTimerStatus {
  if (timer.durationMs === null) return { remainingMs: null, fadeProgress: 0, done: false };
  // A clock that went backwards (a changed system time) counts as no time passed.
  const elapsed = Math.max(0, nowMs - timer.startedAtMs);
  const remainingMs = Math.max(0, timer.durationMs - elapsed);
  const fadeMs = sleepFadeMs(timer.durationMs);
  const fadeProgress = fadeMs > 0 ? Math.min(1, Math.max(0, (fadeMs - remainingMs) / fadeMs)) : 1;
  return { remainingMs, fadeProgress, done: remainingMs === 0 };
}

/**
 * The music level (0–1, times the mode's own level) at a fade progress: a squared curve, so the fall sounds even
 * to the ear instead of lingering loud and then dropping away at the very end.
 */
export function sleepFadeLevel(fadeProgress: number): number {
  const p = Math.min(1, Math.max(0, Number.isFinite(fadeProgress) ? fadeProgress : 0));
  return (1 - p) ** 2;
}
