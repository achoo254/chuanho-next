import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, addRestraint, parseProgress } from './player-progress';

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
