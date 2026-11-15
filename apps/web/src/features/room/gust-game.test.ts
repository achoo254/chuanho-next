import { describe, expect, it } from 'vitest';
import { advanceGusts, FLAME_POINTS, initialGustGame, starsFor, tapGust } from './gust-game-state';
import { EARLY_WINDOW_MS, LATE_WINDOW_MS, gradeShield, matchTap } from './gust-judge';
import { FIRST_GUST_MS, type Gust, MAX_GUSTS, MAX_SPACING_MS, MIN_GUSTS, MIN_SPACING_MS, ROUND_MS, buildGustSchedule, gustSeed } from './gust-schedule';

const GUSTS: readonly Gust[] = [
  { side: 'left', atMs: 3000 },
  { side: 'right', atMs: 5000 },
  { side: 'left', atMs: 7000 },
];

describe('gust schedule', () => {
  it('is the same for the same day and room (any letter case) and differs for another room or day', () => {
    expect(gustSeed('2026-11-15', 'abc234')).toBe(gustSeed('2026-11-15', 'ABC234'));
    expect(gustSeed('2026-11-15', 'ABC234')).not.toBe(gustSeed('2026-11-16', 'ABC234'));
    expect(gustSeed('2026-11-15', 'ABC234')).not.toBe(gustSeed('2026-11-15', 'XYZ789'));
    const seed = gustSeed('2026-11-15', 'ABC234');
    expect(buildGustSchedule(seed)).toEqual(buildGustSchedule(seed));
  });

  it('keeps 12–16 gusts, 1.8–3.2 s apart, inside the round, never four from one side in a row', () => {
    for (let seed = 1; seed < 400; seed += 1) {
      const gusts = buildGustSchedule(seed * 7919);
      expect(gusts.length).toBeGreaterThanOrEqual(MIN_GUSTS);
      expect(gusts.length).toBeLessThanOrEqual(MAX_GUSTS);
      expect(gusts[0]?.atMs).toBe(FIRST_GUST_MS);
      expect(gusts.at(-1)?.atMs ?? 0).toBeLessThanOrEqual(ROUND_MS - 1000);
      gusts.slice(1).forEach((gust, i) => {
        const gap = gust.atMs - (gusts[i]?.atMs ?? 0);
        expect(gap).toBeGreaterThanOrEqual(MIN_SPACING_MS - 1);
        expect(gap).toBeLessThanOrEqual(MAX_SPACING_MS + 1);
      });
      const sides = gusts.map((gust) => gust.side[0]).join('');
      expect(sides).not.toMatch(/llll|rrrr/);
    }
  });
});

describe('gust judge', () => {
  it('grades a shield inside the window and nothing outside it', () => {
    expect(gradeShield(0)).toBe('perfect');
    expect(gradeShield(-200)).toBe('perfect');
    expect(gradeShield(LATE_WINDOW_MS)).toBe('perfect');
    expect(gradeShield(-500)).toBe('good');
    expect(gradeShield(-EARLY_WINDOW_MS - 1)).toBeNull();
    expect(gradeShield(LATE_WINDOW_MS + 1)).toBeNull();
    expect(gradeShield(Number.NaN)).toBeNull();
  });

  it('matches the coming gust of the tapped side, calls the other side wrong, and ignores calm taps', () => {
    const marks = GUSTS.map(() => 'pending' as const);
    expect(matchTap(GUSTS, marks, 'left', 2950)).toEqual({ kind: 'shield', index: 0, grade: 'perfect' });
    expect(matchTap(GUSTS, marks, 'right', 2950)).toEqual({ kind: 'wrong-side', index: 0 });
    expect(matchTap(GUSTS, marks, 'left', 4000)).toEqual({ kind: 'none' });
  });
});

describe('gust game state', () => {
  it('shields build the combo and score; a gust is never judged twice', () => {
    let state = initialGustGame(GUSTS.length);
    const first = tapGust(state, GUSTS, 'left', 3000);
    state = first.state;
    expect(first.event).toEqual({ kind: 'shield', index: 0, grade: 'perfect', combo: 1 });
    const again = tapGust(state, GUSTS, 'left', 3050);
    expect(again.event).toBeNull();
    expect(again.state).toBe(state);
    ({ state } = tapGust(state, GUSTS, 'right', 4500));
    expect(state.marks).toEqual(['perfect', 'good', 'pending']);
    expect(state.combo).toBe(2);
    expect(state.score).toBeGreaterThan(160);
  });

  it('a wrong side or a late gust costs one flame point and the combo', () => {
    let state = initialGustGame(GUSTS.length);
    ({ state } = tapGust(state, GUSTS, 'left', 3000));
    const wrong = tapGust(state, GUSTS, 'left', 5000);
    expect(wrong.event).toEqual({ kind: 'miss', index: 1, reason: 'wrong-side' });
    expect(wrong.state.flame).toBe(FLAME_POINTS - 1);
    expect(wrong.state.combo).toBe(0);
    const late = advanceGusts(wrong.state, GUSTS, 7000 + LATE_WINDOW_MS + 1);
    expect(late.events).toEqual([{ kind: 'miss', index: 2, reason: 'late' }]);
    expect(late.state.ended).toBe('complete');
    expect(starsFor(late.state)).toBe(2);
    expect(advanceGusts(late.state, GUSTS, 99_000).state).toBe(late.state);
  });

  it('ends early, gently, when the flame runs out, and a clean round earns three stars', () => {
    const many: Gust[] = Array.from({ length: 8 }, (_, i) => ({ side: 'left', atMs: 1000 + i * 2000 }));
    const result = advanceGusts(initialGustGame(many.length), many, 60_000);
    expect(result.events).toHaveLength(FLAME_POINTS);
    expect(result.state.ended).toBe('flameLow');
    expect(starsFor(result.state)).toBe(1);
    expect(tapGust(result.state, many, 'left', 11_000).event).toBeNull();

    let clean = initialGustGame(GUSTS.length);
    for (const gust of GUSTS) ({ state: clean } = tapGust(clean, GUSTS, gust.side, gust.atMs));
    expect(clean.ended).toBe('complete');
    expect(starsFor(clean)).toBe(3);
  });
});
