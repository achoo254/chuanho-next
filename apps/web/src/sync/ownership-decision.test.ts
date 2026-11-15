import { EMPTY_PROGRESS } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { blankedDeletionMarks } from './local-data-wipe';
import { decideOwnership, hasLocalData, mergeAllowed } from './ownership-decision';
import { entry } from './sync-engine-harness';

describe('decideOwnership', () => {
  it('lets the same account just sync', () => {
    expect(decideOwnership({ owner: 'x', accountId: 'x', hasLocalData: true })).toEqual({ kind: 'sync' });
  });

  it("asks before uploading a guest's data", () => {
    expect(decideOwnership({ owner: null, accountId: 'x', hasLocalData: true })).toEqual({ kind: 'ask', question: 'merge' });
  });

  it("never offers to merge another account's data", () => {
    expect(decideOwnership({ owner: 'y', accountId: 'x', hasLocalData: true })).toEqual({ kind: 'ask', question: 'startClean' });
  });

  it('starts clean without asking when nothing is worth keeping', () => {
    expect(decideOwnership({ owner: null, accountId: 'x', hasLocalData: false })).toEqual({ kind: 'startClean' });
    expect(decideOwnership({ owner: 'y', accountId: 'x', hasLocalData: false })).toEqual({ kind: 'startClean' });
  });
});

describe('mergeAllowed', () => {
  it("allows a guest's or the account's own data, never another account's", () => {
    expect(mergeAllowed(null, 'x')).toBe(true);
    expect(mergeAllowed('x', 'x')).toBe(true);
    expect(mergeAllowed('y', 'x')).toBe(false);
  });
});

describe('hasLocalData', () => {
  it('counts live entries and progress beyond a fresh device, not deletion marks', () => {
    expect(hasLocalData([], EMPTY_PROGRESS)).toBe(false);
    expect(hasLocalData([{ ...entry('aaaaaaaa-1', 5), deletedAt: 5 }], EMPTY_PROGRESS)).toBe(false);
    expect(hasLocalData([entry('aaaaaaaa-1', 5)], EMPTY_PROGRESS)).toBe(true);
    expect(hasLocalData([], { ...EMPTY_PROGRESS, merit: 1 })).toBe(true);
    expect(hasLocalData([], { ...EMPTY_PROGRESS, moSkin: 'fish' })).toBe(true);
  });
});

describe('blankedDeletionMarks', () => {
  it('deletes every entry, keeps nothing personal and never goes back in time', () => {
    const live = { ...entry('aaaaaaaa-1', 50, 'private'), released: { reset: true, apology: false, deed: true } };
    const ahead = { ...entry('bbbbbbbb-2', 900, 'later'), deletedAt: 900 };
    const [a, b] = blankedDeletionMarks([live, ahead], 100);
    expect(a).toMatchObject({ note: '', deletedAt: 100, updatedAt: 100, released: { reset: false, apology: false, deed: false } });
    expect(b).toMatchObject({ note: '', deletedAt: 900, updatedAt: 900 });
  });
});
