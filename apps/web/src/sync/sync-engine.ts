/**
 * Account sync, local-first: the game never waits for it. While an account is signed in it syncs right away (the first
 * sync of an account uploads everything on the device), then every minute, when the tab comes back into view, and a
 * few seconds after a local change. One request at a time; a change during a request syncs again after it. A
 * collection that holds part of its changes back (a large journal) gets follow-up requests right away, and the sync
 * only counts as done (`lastSyncedAt` moves) once all of them went through.
 *
 * Every request carries the account's data epoch (see sync-answer.ts for a newer one in the answer).
 *
 * Failures never lose local data: offline or a server error retries with a growing pause; 401 hands over to the
 * account (now a guest; the bookmark stays as the data's owner mark); a collection the server reports full (409) stops
 * sending, keeps receiving, and the status says so. Pure core: the network, the clock, timers and storage are injected.
 */
import type { SyncRequest, SyncResponse } from '@chuanho/contract';
import type { ApiResult } from '../account/account-api';
import { EMPTY_PAYLOAD, takeSyncAnswer } from './sync-answer';
import type { SyncEngine, SyncEngineDeps, SyncStatus } from './sync-engine-types';
import type { SyncBookmark } from './sync-state-storage';
import type { SyncPayload, SyncedCollection } from './synced-collection';

export type { SyncClock, SyncEngine, SyncEngineDeps, SyncState, SyncStatus } from './sync-engine-types';

export const SYNC_EVERY_MS = 60_000;
export const SYNC_AFTER_CHANGE_MS = 3_000;
const RETRY_FIRST_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
/** A tab flicking in and out of view does not sync each time. */
const VISIBLE_MIN_GAP_MS = 10_000;

const IDLE: SyncStatus = { state: 'idle', lastSyncedAt: null, full: [] };

export const retryDelay = (failures: number): number => Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** Math.max(0, failures - 1));

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { collections, storage, clock } = deps;
  const listeners = new Set<() => void>();
  let status: SyncStatus = IDLE;
  let bookmark: SyncBookmark | null = null;
  let full = new Set<string>();
  let generation = 0;
  let inFlight = false;
  let again = false;
  let failures = 0;
  let lastAttemptAt = 0;
  /** Start time of the first request of a sync still sending held-back changes; null when none is under way. */
  let drainingSince: number | null = null;
  let cancelTimer: (() => void) | null = null;

  const setStatus = (next: Partial<SyncStatus>): void => {
    status = { ...status, ...next };
    for (const listener of listeners) listener();
  };
  const active = (): SyncedCollection[] => collections.filter((collection) => !full.has(collection.key));
  const hasPending = (since: number): boolean => active().some((collection) => collection.hasPending(since));
  const schedule = (ms: number): void => {
    cancelTimer?.();
    cancelTimer = clock.later(() => {
      cancelTimer = null;
      void run();
    }, ms);
  };
  const fail = (state: 'error' | 'offline'): void => {
    failures += 1;
    setStatus({ state });
    schedule(retryDelay(failures));
  };

  async function send(request: SyncRequest): Promise<ApiResult<SyncResponse>> {
    try {
      return await deps.send(request);
    } catch {
      return { ok: false, error: { kind: 'offline' } };
    }
  }

  async function run(): Promise<void> {
    const current = bookmark;
    if (!current) return;
    if (inFlight) {
      again = true;
      return;
    }
    const mine = generation;
    const since = current.lastSyncedAt;
    const startedAt = drainingSince ?? clock.now();
    const sent: SyncPayload = Object.assign({}, EMPTY_PAYLOAD, ...active().map((collection) => collection.collect(since)));
    inFlight = true;
    again = false;
    lastAttemptAt = clock.now();
    cancelTimer?.();
    setStatus({ state: 'syncing' });
    const result = await send({ ...sent, cursor: current.cursor, epoch: current.epoch });
    // Stopped, restarted or switched account while the request was out: its answer belongs to nobody now.
    if (mine !== generation) return;
    inFlight = false;

    if (result.ok) {
      const taken = takeSyncAnswer({ collections, active: active(), discardLocal: deps.discardLocal, now: clock.now() }, current, result.value, sent, startedAt);
      bookmark = taken.bookmark;
      storage.save(bookmark);
      failures = 0;
      if (taken.more) {
        drainingSince = startedAt;
        void run();
        return;
      }
      drainingSince = null;
      const doneAt = bookmark.lastSyncedAt;
      setStatus({ state: 'idle', lastSyncedAt: doneAt });
      // A change made while the request was out goes in its own sync, after the usual short pause.
      schedule(again && hasPending(doneAt) ? SYNC_AFTER_CHANGE_MS : SYNC_EVERY_MS);
      again = false;
      return;
    }
    const { error } = result;
    if (error.kind === 'unauthorized') {
      // The bookmark stays: the device's data still belongs to this account (see sync-state-storage.ts).
      engine.stop();
      deps.onUnauthorized();
      return;
    }
    const filled = error.kind === 'conflict' ? collections.find((collection) => collection.fullCode === error.code) : undefined;
    if (filled && !full.has(filled.key)) {
      full = new Set([...full, filled.key]);
      setStatus({ full: [...full] });
      void run();
      return;
    }
    fail(error.kind === 'offline' ? 'offline' : 'error');
  }

  const resetRun = (next: SyncBookmark | null): void => {
    generation += 1;
    cancelTimer?.();
    cancelTimer = null;
    inFlight = false;
    again = false;
    failures = 0;
    full = new Set();
    drainingSince = null;
    bookmark = next;
    for (const collection of collections) collection.reset();
  };

  const engine: SyncEngine = {
    start(accountId, options) {
      if (bookmark?.accountId === accountId && !options?.fromNow) return;
      const stored = storage.load();
      const next =
        stored?.accountId === accountId && !options?.fromNow
          ? stored
          : { accountId, cursor: 0, lastSyncedAt: options?.fromNow ? clock.now() + 1 : 0, epoch: 0 };
      resetRun(next);
      // Saved now, not after the first sync: it marks the device's data as this account's from this moment.
      storage.save(next);
      status = { ...IDLE, lastSyncedAt: next.lastSyncedAt > 0 && !options?.fromNow ? next.lastSyncedAt : null };
      void run();
    },
    stop(options) {
      resetRun(null);
      if (options?.forget) storage.clear();
      setStatus(IDLE);
    },
    localChange() {
      if (!bookmark) return;
      if (inFlight) {
        again = true;
        return;
      }
      // While retrying after a failure the retry timer stands: a burst of changes must not hammer a server that is down.
      if (failures === 0 && hasPending(bookmark.lastSyncedAt)) schedule(SYNC_AFTER_CHANGE_MS);
    },
    regainVisibility() {
      if (!bookmark || inFlight || clock.now() - lastAttemptAt < VISIBLE_MIN_GAP_MS) return;
      void run();
    },
    restartFromNow() {
      // Epoch 0: the server takes this device's (empty) state and answers the account's new epoch.
      if (bookmark) engine.start(bookmark.accountId, { fromNow: true });
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return engine;
}
