import { EMPTY_PROGRESS } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS } from '../game/player-progress';
import { adoptServerProgress, fromProgressDoc, toProgressDoc } from './progress-doc';
import { parseSyncBookmark } from './sync-state-storage';

describe('progress doc', () => {
  it('round-trips the device progress', () => {
    const local = { ...DEFAULT_PROGRESS, merit: 40, moSkin: 'fish' as const, updatedAt: 1_700_000_000_000 };
    expect(fromProgressDoc(toProgressDoc(local))).toEqual(local);
    expect(toProgressDoc(DEFAULT_PROGRESS)).toEqual(EMPTY_PROGRESS);
  });

  it('keeps the same object when the server brings nothing new', () => {
    const local = { ...DEFAULT_PROGRESS, merit: 40 };
    expect(adoptServerProgress(local, { ...EMPTY_PROGRESS, merit: 20 })).toBe(local);
  });

  it('takes larger counters and the newer preferences', () => {
    const local = { ...DEFAULT_PROGRESS, merit: 40, moSkin: 'carved' as const, updatedAt: 100 };
    const next = adoptServerProgress(local, { ...EMPTY_PROGRESS, merit: 60, bestCombo: 12, moSkin: 'fish', updatedAt: 200 });
    expect(next).toMatchObject({ merit: 60, bestCombo: 12, moSkin: 'fish', updatedAt: 200 });
  });

  it('keeps the device preferences when they are newer', () => {
    const local = { ...DEFAULT_PROGRESS, ambientSounds: false, updatedAt: 300 };
    expect(adoptServerProgress(local, { ...EMPTY_PROGRESS, merit: 5, updatedAt: 200 })).toMatchObject({ merit: 5, ambientSounds: false, updatedAt: 300 });
  });
});

describe('parseSyncBookmark', () => {
  it('reads a valid bookmark, including a never-synced one and one stored before epochs (epoch 0)', () => {
    expect(parseSyncBookmark({ accountId: 'u1', cursor: 4, lastSyncedAt: 1_700_000_000_000, epoch: 3 })).toEqual({ accountId: 'u1', cursor: 4, lastSyncedAt: 1_700_000_000_000, epoch: 3 });
    expect(parseSyncBookmark({ accountId: 'u1', cursor: 4, lastSyncedAt: 1_700_000_000_000 })?.epoch).toBe(0);
    expect(parseSyncBookmark({ accountId: 'u1', cursor: 0, lastSyncedAt: 0 })?.lastSyncedAt).toBe(0);
  });

  it('rejects anything off', () => {
    for (const bad of [null, [], { cursor: 1, lastSyncedAt: 0 }, { accountId: '', cursor: 1, lastSyncedAt: 0 }, { accountId: 'u', cursor: -1, lastSyncedAt: 0 }, { accountId: 'u', cursor: 1, lastSyncedAt: 'x' }, { accountId: 'u', cursor: 1, lastSyncedAt: 0, epoch: -1 }]) {
      expect(parseSyncBookmark(bad)).toBeNull();
    }
  });
});
