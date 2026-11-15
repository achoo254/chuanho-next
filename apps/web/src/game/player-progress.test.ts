import { MO_SKIN_IDS } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, MO_SKINS, addRestraint, parseProgress, stampPreferences } from './player-progress';

describe('parseProgress', () => {
  it('keeps a valid restraint count', () => {
    expect(parseProgress({ ...DEFAULT_PROGRESS, restraintCount: 7 })?.restraintCount).toBe(7);
  });

  it('defaults the restraint count when it is missing (progress saved before the journal existed)', () => {
    const { restraintCount: _dropped, ...older } = DEFAULT_PROGRESS;
    expect(parseProgress({ ...older, merit: 30 })).toEqual({ ...DEFAULT_PROGRESS, merit: 30 });
  });

  it('drops a bad restraint count without losing the other fields', () => {
    for (const bad of [-1, 1.5, '3', null]) {
      const parsed = parseProgress({ ...DEFAULT_PROGRESS, merit: 20, restraintCount: bad });
      expect(parsed?.restraintCount).toBe(0);
      expect(parsed?.merit).toBe(20);
    }
  });

  it('rejects what is not an object', () => {
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress('progress')).toBeNull();
  });
});

describe('addRestraint', () => {
  it('counts one more held-back word and leaves the rest alone', () => {
    const next = addRestraint({ ...DEFAULT_PROGRESS, restraintCount: 2, merit: 10 });
    expect(next.restraintCount).toBe(3);
    expect(next.merit).toBe(10);
  });
});

describe('preferences stamp', () => {
  it('keeps a stored stamp and falls back to the floor value when it is missing or bad', () => {
    expect(parseProgress({ ...DEFAULT_PROGRESS, updatedAt: 1_700_000_000_000 })?.updatedAt).toBe(1_700_000_000_000);
    expect(parseProgress({ merit: 3 })?.updatedAt).toBe(1);
    expect(parseProgress({ ...DEFAULT_PROGRESS, updatedAt: -5 })?.updatedAt).toBe(1);
  });

  it('moves only when a preference changed', () => {
    const before = { ...DEFAULT_PROGRESS, updatedAt: 100 };
    expect(stampPreferences(before, { ...before, merit: 10 }, 5_000).updatedAt).toBe(100);
    expect(stampPreferences(before, { ...before, moSkin: 'fish' }, 5_000).updatedAt).toBe(5_000);
    expect(stampPreferences(before, { ...before, ambientSounds: false }, 5_000).updatedAt).toBe(5_000);
  });

  it('never goes backwards when the clock is behind the stored stamp', () => {
    const before = { ...DEFAULT_PROGRESS, updatedAt: 9_000 };
    expect(stampPreferences(before, { ...before, moSkin: 'carved' }, 5_000).updatedAt).toBe(9_001);
  });
});

describe('MO_SKINS', () => {
  it('lists exactly the contract skins, in order', () => {
    expect(MO_SKINS.map((skin) => skin.id)).toEqual([...MO_SKIN_IDS]);
  });
});
