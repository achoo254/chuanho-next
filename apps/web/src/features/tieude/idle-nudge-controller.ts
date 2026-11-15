/**
 * The rhythm of an occasional nudge, apart from React and from real time: the first one comes a while after the
 * place becomes idle, then one every so often (a random gap in a range), each stays on screen for a moment, and a
 * tap dismisses it early. Leaving the idle place (a panel opens, the player goes elsewhere) cancels everything and
 * the count starts again when it is idle again. Timers are injected so tests drive the clock by hand.
 */

export interface NudgeTimers {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

export interface IdleNudgeOptions {
  /** Wait after becoming idle before the first nudge. */
  readonly firstDelayMs: number;
  /** Gap between the end of one nudge and the next: a random value in [min, max]. */
  readonly gapMs: readonly [number, number];
  /** How long a nudge stays up when nobody taps it. */
  readonly showMs: number;
  /** A number in [0, 1), Math.random in the app. */
  readonly random: () => number;
  /** Asked just before each nudge; false skips this one (e.g. silenced for today) and waits for the next gap. */
  readonly allowed?: () => boolean;
}

export interface IdleNudgeController {
  /** The place is idle (true) or busy (false); busy hides any nudge and cancels the waits. */
  setIdle(idle: boolean): void;
  /** Hides the nudge on screen now; the next one comes after a gap. */
  dismiss(): void;
  /** Stops for good (unmount). */
  dispose(): void;
}

/** `onShow(n)` puts the n-th nudge (counted from 1) on screen; `onHide()` takes it down. */
export function createIdleNudgeController(options: IdleNudgeOptions, timers: NudgeTimers, onShow: (count: number) => void, onHide: () => void): IdleNudgeController {
  let timer: number | null = null;
  let showing = false;
  let idle = false;
  let count = 0;

  const clear = (): void => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  const gap = (): number => {
    const [min, max] = options.gapMs;
    return min + Math.floor(options.random() * Math.max(0, max - min + 1));
  };
  const hide = (): void => {
    if (!showing) return;
    showing = false;
    onHide();
  };
  const wait = (ms: number): void => {
    clear();
    timer = timers.setTimeout(show, ms);
  };
  function show(): void {
    timer = null;
    if (!idle) return;
    if (options.allowed && !options.allowed()) {
      wait(gap());
      return;
    }
    count += 1;
    showing = true;
    onShow(count);
    timer = timers.setTimeout(() => {
      hide();
      wait(gap());
    }, options.showMs);
  }

  return {
    setIdle(next) {
      if (next === idle) return;
      idle = next;
      clear();
      hide();
      if (idle) wait(options.firstDelayMs);
    },
    dismiss() {
      if (!showing) return;
      hide();
      if (idle) wait(gap());
    },
    dispose() {
      idle = false;
      clear();
      showing = false;
    },
  };
}
