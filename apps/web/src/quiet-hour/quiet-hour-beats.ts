/**
 * Sends the player's mõ strokes to the shared "Giờ Tĩnh" count in small batches (every few seconds and when the
 * player leaves the mode), never one request per stroke. Pure: network, clock and timers are injected.
 *
 * Strokes count only while signed in and while the half hour is on (server time). The per-person cap is respected
 * here too, so a long session stops sending once the server would ignore it. A batch the server refuses because the
 * half hour closed is dropped quietly; one that could not reach it waits for the next flush while the window lasts.
 */
import { QUIET_HOUR_BATCH_MAX, QUIET_HOUR_PERSON_CAP, type QuietHourBeatsInput, type QuietHourStatus, isQuietHourNow, vietnamDay } from '@chuanho/contract';
import type { ApiResult } from '../account/account-api';

export const FLUSH_EVERY_MS = 5_000;

export interface BeatBatcherDeps {
  send(input: QuietHourBeatsInput): Promise<ApiResult<QuietHourStatus>>;
  /** The server's time now (device time plus the learned offset). */
  serverNow(): number;
  isSignedIn(): boolean;
  /** Runs `run` after `ms`; returns a cancel function. */
  later(run: () => void, ms: number): () => void;
  /** The status the server answered after a batch (fresher than the last poll). */
  onStatus(status: QuietHourStatus): void;
}

export interface BeatBatcher {
  /** One stroke by the player. */
  add(): void;
  /** Sends what is waiting now (leaving the mode). */
  flush(): Promise<void>;
  /** How many strokes wait to be sent (for tests and debugging). */
  pending(): number;
}

export function createBeatBatcher(deps: BeatBatcherDeps): BeatBatcher {
  let waiting = 0;
  let day = '';
  /** Strokes the server accepted from this device tonight. */
  let sent = 0;
  let sending = false;
  let cancelTimer: (() => void) | null = null;

  const open = (now: number): boolean => deps.isSignedIn() && isQuietHourNow(now);
  const schedule = (): void => {
    if (cancelTimer) return;
    cancelTimer = deps.later(() => {
      cancelTimer = null;
      void flush();
    }, FLUSH_EVERY_MS);
  };

  async function flush(): Promise<void> {
    cancelTimer?.();
    cancelTimer = null;
    if (sending) return;
    sending = true;
    try {
      while (waiting > 0) {
        const now = deps.serverNow();
        if (!open(now) || vietnamDay(now) !== day) {
          waiting = 0;
          return;
        }
        const count = Math.min(waiting, QUIET_HOUR_BATCH_MAX);
        waiting -= count;
        const result = await deps.send({ day, count });
        if (result.ok) {
          sent += count;
          deps.onStatus(result.value);
        } else if (result.error.kind === 'offline' || result.error.kind === 'server') {
          // Kept for the next flush; the window check above drops it once the half hour is over.
          waiting += count;
          schedule();
          return;
        } else {
          // Closed (409), signed out (401) or refused: these strokes cannot count any more.
          waiting = 0;
          return;
        }
      }
    } finally {
      sending = false;
    }
  }

  return {
    add() {
      const now = deps.serverNow();
      if (!open(now)) return;
      const today = vietnamDay(now);
      if (today !== day) {
        day = today;
        sent = 0;
        waiting = 0;
      }
      if (sent + waiting >= QUIET_HOUR_PERSON_CAP) return;
      waiting += 1;
      schedule();
    },
    flush,
    pending: () => waiting,
  };
}
