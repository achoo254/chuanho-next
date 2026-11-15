/**
 * Account sync, local-first: the game never waits for it. While an account is signed in it syncs right away (the first
 * sync of an account uploads everything on the device), then every minute, when the tab comes back into view, and a
 * few seconds after a local change. One request at a time; a change during a request syncs again after it.
 *
 * Failures never lose local data: offline or a server error retries with a growing pause; 401 hands over to the
 * account (now a guest); a collection the server reports full (409) stops sending, keeps receiving, and the status
 * says so. Pure core: the network, the clock, timers and storage are injected.
 */
import { EMPTY_PROGRESS, type SyncResponse } from '@chuanho/contract';
import type { ApiResult } from '../account/account-api';
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
const EMPTY_PAYLOAD: SyncPayload = { progress: EMPTY_PROGRESS, journal: [] };

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

  async function send(request: SyncPayload & { readonly cursor: number }): Promise<ApiResult<SyncResponse>> {
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
    const startedAt = clock.now();
    const sent: SyncPayload = Object.assign({}, EMPTY_PAYLOAD, ...active().map((collection) => collection.collect(since)));
    inFlight = true;
    again = false;
    lastAttemptAt = startedAt;
    cancelTimer?.();
    setStatus({ state: 'syncing' });
    const result = await send({ ...sent, cursor: current.cursor });
    // Stopped, restarted or switched account while the request was out: its answer belongs to nobody now.
    if (mine !== generation) return;
    inFlight = false;

    if (result.ok) {
      for (const collection of collections) collection.apply(result.value, sent);
      bookmark = { accountId: current.accountId, cursor: result.value.cursor, lastSyncedAt: startedAt };
      storage.save(bookmark);
      failures = 0;
      setStatus({ state: 'idle', lastSyncedAt: startedAt });
      // A change made while the request was out goes in its own sync, after the usual short pause.
      schedule(again && hasPending(startedAt) ? SYNC_AFTER_CHANGE_MS : SYNC_EVERY_MS);
      again = false;
      return;
    }
    const { error } = result;
    if (error.kind === 'unauthorized') {
      engine.stop({ forget: true });
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
    bookmark = next;
    for (const collection of collections) collection.reset();
  };

  const engine: SyncEngine = {
    start(accountId) {
      if (bookmark?.accountId === accountId) return;
      const stored = storage.load();
      const next = stored?.accountId === accountId ? stored : { accountId, cursor: 0, lastSyncedAt: 0 };
      if (stored && stored !== next) storage.clear();
      resetRun(next);
      status = { ...IDLE, lastSyncedAt: next.lastSyncedAt > 0 ? next.lastSyncedAt : null };
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
      if (!bookmark) return;
      const next = { accountId: bookmark.accountId, cursor: 0, lastSyncedAt: clock.now() + 1 };
      resetRun(next);
      storage.save(next);
      setStatus({ state: 'idle', full: [] });
      void run();
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
