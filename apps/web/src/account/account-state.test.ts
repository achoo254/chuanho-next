import { describe, expect, it } from 'vitest';
import type { ApiResult } from './account-api';
import { type AccountState, GUEST, LOADING, nameInitial, nextAccountState, shouldRecheck } from './account-state';
import { syncStatusLine, syncTimeLabel } from './sync-status-line';

const me = (name = 'Lan'): ApiResult<{ id: string; name: string }> => ({ ok: true, value: { id: 'u1', name } });
const failed = (kind: 'unauthorized' | 'offline' | 'invalid'): ApiResult<never> => ({ ok: false, error: { kind } });
const signedIn: AccountState = { status: 'signedIn', user: { id: 'u1', name: 'Lan' } };

describe('nextAccountState', () => {
  it('signs in from any state and keeps the same object when nothing changed', () => {
    expect(nextAccountState(LOADING, me())).toEqual(signedIn);
    expect(nextAccountState(signedIn, me())).toBe(signedIn);
    expect(nextAccountState(signedIn, me('Mai'))).toEqual({ status: 'signedIn', user: { id: 'u1', name: 'Mai' } });
  });

  it('treats no server as a guest, never an error screen', () => {
    expect(nextAccountState(LOADING, failed('offline'))).toBe(GUEST);
  });

  it('keeps a signed-in player through a network blip or a bad answer', () => {
    expect(nextAccountState(signedIn, failed('offline'))).toBe(signedIn);
    expect(nextAccountState(signedIn, failed('invalid'))).toBe(signedIn);
  });

  it('becomes a guest on 401 and an error on a real server failure', () => {
    expect(nextAccountState(signedIn, failed('unauthorized'))).toBe(GUEST);
    expect(nextAccountState(LOADING, failed('invalid'))).toEqual({ status: 'error' });
  });
});

describe('account helpers', () => {
  it('re-checks at most every 15 s', () => {
    expect(shouldRecheck(0, 15_000)).toBe(true);
    expect(shouldRecheck(10_000, 20_000)).toBe(false);
  });

  it('takes the first letter of the name, upper-cased', () => {
    expect(nameInitial(' đức')).toBe('Đ');
    expect(nameInitial('')).toBeNull();
  });
});

describe('sync status line', () => {
  const at = new Date(2027, 0, 15, 14, 5).getTime();
  it('says when it last synced', () => {
    expect(syncStatusLine({ state: 'idle', lastSyncedAt: at, full: [] }, 'vi', at + 60_000)).toEqual({ key: 'syncedAt', vars: { time: '14:05' } });
    expect(syncStatusLine({ state: 'idle', lastSyncedAt: null, full: [] }, 'vi', at).key).toBe('notSynced');
    expect(syncStatusLine({ state: 'offline', lastSyncedAt: at, full: [] }, 'vi', at).key).toBe('offline');
    expect(syncStatusLine({ state: 'syncing', lastSyncedAt: at, full: [] }, 'en', at).key).toBe('syncing');
  });

  it('adds the day for an older sync', () => {
    expect(syncTimeLabel(at, at + 2 * 86_400_000, 'en')).toMatch(/15\/01/);
    expect(syncTimeLabel(at, at + 2 * 86_400_000, 'zh-CN')).toMatch(/01\/15/);
  });
});
