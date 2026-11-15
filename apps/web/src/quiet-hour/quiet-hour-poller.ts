/**
 * The polling loop of the quiet-hour status, kept to exactly one chain: one timer handle, cleared synchronously before
 * each poll, at most one request out at a time, and nothing scheduled once stopped. Coming back into view (`wake`)
 * polls at once, unless a request is already out (that one schedules the next). A hidden tab skips the request but
 * keeps the chain alive. Pure: the request, visibility, the delay and the timer are injected.
 */
export interface QuietHourPollerDeps {
  /** Fetches and takes the status; never expected to throw (a throw counts as a failed poll). */
  check(): Promise<void>;
  isVisible(): boolean;
  /** The pause before the next poll, read when it is scheduled. */
  nextDelay(): number;
  later(run: () => void, ms: number): () => void;
}

export interface QuietHourPoller {
  start(): void;
  /** The tab is in view again. */
  wake(): void;
  stop(): void;
}

export function createQuietHourPoller(deps: QuietHourPollerDeps): QuietHourPoller {
  let cancel: (() => void) | null = null;
  let inFlight = false;
  let stopped = false;

  const clearTimer = (): void => {
    cancel?.();
    cancel = null;
  };
  const schedule = (): void => {
    if (stopped) return;
    cancel = deps.later(() => void poll(), deps.nextDelay());
  };

  async function poll(): Promise<void> {
    clearTimer();
    if (stopped || inFlight) return;
    if (deps.isVisible()) {
      inFlight = true;
      try {
        await deps.check();
      } catch {
        // A failed poll just waits for the next one.
      } finally {
        inFlight = false;
      }
    }
    schedule();
  }

  return {
    start: () => void poll(),
    wake() {
      if (stopped || inFlight || !deps.isVisible()) return;
      void poll();
    },
    stop() {
      stopped = true;
      clearTimer();
    },
  };
}
