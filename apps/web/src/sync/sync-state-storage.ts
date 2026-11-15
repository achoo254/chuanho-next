/**
 * Where this browser's sync bookmark lives (`chuanho.sync.v1`): which account the data on this device belongs to, the
 * server cursor, when the last sync started and the account's data epoch.
 *
 * The bookmark doubles as the owner mark of the local data (progress and journal): it is written as soon as an account
 * claims the data and it survives signing out, so a different account signing in on a shared device is never handed
 * someone else's data (see ownership-decision.ts). No bookmark means the data is a guest's. It is removed only when the
 * device's data stops belonging to the account: wiped on sign-out, or kept as a guest's after "delete on the server".
 */
import { isCount, isEpochMs, isRecord } from '@chuanho/contract';
import { readStored, writeStored } from '../game/safe-storage';

export const SYNC_STORAGE_KEY = 'chuanho.sync.v1';

export interface SyncBookmark {
  /** The account this device's data belongs to. */
  readonly accountId: string;
  readonly cursor: number;
  /** Device time at which the last successful sync read the local data; 0 = never synced. */
  readonly lastSyncedAt: number;
  /** The account's data epoch the server last answered; 0 = not known yet (the server then takes the upload). */
  readonly epoch: number;
}

export interface SyncBookmarkStorage {
  load(): SyncBookmark | null;
  save(bookmark: SyncBookmark): void;
  clear(): void;
}

export function parseSyncBookmark(raw: unknown): SyncBookmark | null {
  if (!isRecord(raw) || typeof raw.accountId !== 'string' || raw.accountId === '') return null;
  if (!isCount(raw.cursor, Number.MAX_SAFE_INTEGER)) return null;
  const lastSyncedAt = raw.lastSyncedAt === 0 || isEpochMs(raw.lastSyncedAt) ? raw.lastSyncedAt : null;
  // A bookmark written before epochs existed knows none yet.
  const epoch = raw.epoch === undefined ? 0 : raw.epoch;
  if (lastSyncedAt === null || !isCount(epoch, Number.MAX_SAFE_INTEGER)) return null;
  return { accountId: raw.accountId, cursor: raw.cursor, lastSyncedAt, epoch };
}

export const localSyncBookmarkStorage: SyncBookmarkStorage = {
  load: () => readStored(SYNC_STORAGE_KEY, parseSyncBookmark),
  save: (bookmark) => {
    writeStored(SYNC_STORAGE_KEY, bookmark);
  },
  clear: () => {
    try {
      window.localStorage.removeItem(SYNC_STORAGE_KEY);
    } catch {
      // Storage refused: nothing was stored either, so there is nothing to forget.
    }
  },
};
