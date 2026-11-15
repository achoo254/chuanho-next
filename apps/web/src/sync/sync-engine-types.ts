/** The sync engine's public shapes (sync-engine.ts has the behaviour). */
import type { SyncResponse } from '@chuanho/contract';
import type { ApiResult } from '../account/account-api';
import type { SyncBookmarkStorage } from './sync-state-storage';
import type { SyncPayload, SyncedCollection } from './synced-collection';

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncStatus {
  readonly state: SyncState;
  /** Device time of the last successful sync of this account, null before the first one. */
  readonly lastSyncedAt: number | null;
  /** Keys of the collections the server reported full (they no longer upload). */
  readonly full: readonly string[];
}

export interface SyncClock {
  now(): number;
  /** Runs `run` after `ms`; returns a cancel function. */
  later(run: () => void, ms: number): () => void;
}

export interface SyncEngineDeps {
  readonly collections: readonly SyncedCollection[];
  send(request: SyncPayload & { readonly cursor: number }): Promise<ApiResult<SyncResponse>>;
  readonly storage: SyncBookmarkStorage;
  readonly clock: SyncClock;
  /** The server no longer knows the session. */
  onUnauthorized(): void;
}

export interface SyncEngine {
  /** Starts (or keeps) syncing `accountId`; another account's bookmark is dropped first. */
  start(accountId: string): void;
  /** Stops syncing; `forget` also removes the bookmark (signing out). Local data is never touched. */
  stop(options?: { readonly forget?: boolean }): void;
  /** Something changed on the device. */
  localChange(): void;
  /** The tab is in view again. */
  regainVisibility(): void;
  /** The server's data is gone and the device's was wiped on purpose: start over from now, uploading nothing older. */
  restartFromNow(): void;
  getStatus(): SyncStatus;
  subscribe(listener: () => void): () => void;
}
