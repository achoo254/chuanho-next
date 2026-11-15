/** The sync engine's public shapes (sync-engine.ts has the behaviour). */
import type { SyncRequest, SyncResponse } from '@chuanho/contract';
import type { ApiResult } from '../account/account-api';
import type { SyncBookmarkStorage } from './sync-state-storage';
import type { SyncedCollection } from './synced-collection';

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
  send(request: SyncRequest): Promise<ApiResult<SyncResponse>>;
  readonly storage: SyncBookmarkStorage;
  readonly clock: SyncClock;
  /** The server no longer knows the session. */
  onUnauthorized(): void;
  /**
   * The account's data was deleted from another device (the server answered a newer epoch): drop this device's copy of
   * the synced data, as on a fresh device. The engine then adopts the server's current state.
   */
  discardLocal(): void;
}

export interface SyncEngine {
  /**
   * Starts (or keeps) syncing `accountId`, which now owns the device's data: its bookmark is saved at once. Another
   * account's bookmark is dropped first. `fromNow` starts over uploading nothing older than now (the device's data was
   * just wiped for this account).
   */
  start(accountId: string, options?: { readonly fromNow?: boolean }): void;
  /**
   * Stops syncing. The bookmark stays as the owner mark of the device's data (signing out keeps it); `forget` removes
   * it, making the data a guest's. Local data is never touched here.
   */
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
