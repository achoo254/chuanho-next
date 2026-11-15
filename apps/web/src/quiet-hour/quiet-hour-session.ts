/**
 * The page's "Giờ Tĩnh" state outside React: the last status, the server clock offset learned from it, whether the
 * player is signed in, and the one stroke batcher reading all of that when it sends. The provider subscribes to it.
 */
import type { QuietHourStatus } from '@chuanho/contract';
import type { AccountApi } from '../account/account-api';
import { type BeatBatcher, createBeatBatcher } from './quiet-hour-beats';
import { serverOffset } from './quiet-hour-clock';

export interface QuietHourSnapshot {
  readonly status: QuietHourStatus | null;
  /** Server clock minus device clock (ms). */
  readonly offset: number;
}

export interface QuietHourSession {
  readonly batcher: BeatBatcher;
  getSnapshot(): QuietHourSnapshot;
  subscribe(listener: () => void): () => void;
  /** A status the server answered just now: learns the clock offset from it. */
  take(status: QuietHourStatus, receivedAt: number): void;
  setSignedIn(signedIn: boolean): void;
  /** The server's time now, by this device's clock plus the offset. */
  serverNow(): number;
}

export function createQuietHourSession(
  api: Pick<AccountApi, 'sendQuietHourBeats'>,
  later: (run: () => void, ms: number) => () => void,
  deviceNow: () => number = Date.now,
): QuietHourSession {
  let snapshot: QuietHourSnapshot = { status: null, offset: 0 };
  let signedIn = false;
  const listeners = new Set<() => void>();
  const serverNow = (): number => deviceNow() + snapshot.offset;

  const take = (status: QuietHourStatus, receivedAt: number): void => {
    snapshot = { status, offset: serverOffset(status.serverNow, receivedAt) };
    for (const listener of listeners) listener();
  };

  const batcher = createBeatBatcher({
    send: (input) => api.sendQuietHourBeats(input),
    serverNow,
    isSignedIn: () => signedIn,
    later,
    onStatus: (status) => take(status, deviceNow()),
  });

  return {
    batcher,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    take,
    setSignedIn(next) {
      signedIn = next;
    },
    serverNow,
  };
}
