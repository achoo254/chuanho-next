/**
 * The work mode's focus rhythm (25 minutes of focus, 5 of rest, round and round) as a pure function of a clock
 * reading in milliseconds, injected by the caller. The state is only when the rhythm started, so a throttled
 * background tab or a sleeping phone simply reads the right phase when it wakes up. `switches` counts the phase
 * changes so far: the screen chimes when it goes up (once, however many switches a long sleep skipped).
 */

export type PomodoroPhase = 'focus' | 'break';

export interface PomodoroConfig {
  readonly focusMs: number;
  readonly breakMs: number;
}

export const CLASSIC_POMODORO: PomodoroConfig = { focusMs: 25 * 60_000, breakMs: 5 * 60_000 };

export interface PomodoroStatus {
  readonly phase: PomodoroPhase;
  /** Milliseconds left in the current phase. */
  readonly remainingMs: number;
  /** Phase changes since the start. */
  readonly switches: number;
}

export function pomodoroStatus(startedAtMs: number, nowMs: number, config: PomodoroConfig = CLASSIC_POMODORO): PomodoroStatus {
  const { focusMs, breakMs } = config;
  if (!(focusMs > 0 && breakMs > 0)) throw new RangeError('Pomodoro phases must be longer than zero');
  // A clock that went backwards (a changed system time) counts as no time passed.
  const elapsed = Math.max(0, nowMs - startedAtMs);
  const cycleMs = focusMs + breakMs;
  const cycles = Math.floor(elapsed / cycleMs);
  const intoCycle = elapsed - cycles * cycleMs;
  if (intoCycle < focusMs) return { phase: 'focus', remainingMs: focusMs - intoCycle, switches: cycles * 2 };
  return { phase: 'break', remainingMs: cycleMs - intoCycle, switches: cycles * 2 + 1 };
}
