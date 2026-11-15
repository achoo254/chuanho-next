/**
 * Where this browser's sync bookmark lives: which account it belongs to, the server cursor and when the last sync
 * started (`chuanho.sync.v1`). One account at a time: a bookmark of another account is ignored and replaced, and
 * signing out removes it, so one account's position never carries over to another on a shared browser.
 */
import { isCount, isEpochMs, isRecord } from '@chuanho/contract';
import { readStored, writeStored } from '../game/safe-storage';

export const SYNC_STORAGE_KEY = 'chuanho.sync.v1';

export interface SyncBookmark {
  readonly accountId: string;
  readonly cursor: number;
  /** Device time at which the last successful sync read the local data; 0 = never synced. */
  readonly lastSyncedAt: number;
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
  return lastSyncedAt === null ? null : { accountId: raw.accountId, cursor: raw.cursor, lastSyncedAt };
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
