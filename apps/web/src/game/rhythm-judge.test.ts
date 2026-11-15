import { describe, expect, it } from 'vitest';
import { applyTap, expireMissedNotes, initialRhythmState, isSongJudged } from './rhythm-judge';

const NOTES = [1000, 2000, 3000];

describe('rhythm judge', () => {
  it('grades the nearest note and builds the combo and battery', () => {
    let state = initialRhythmState(NOTES.length);
    ({ state } = applyTap(state, NOTES, 1010));
    ({ state } = applyTap(state, NOTES, 2100));
    expect(state.noteStates).toEqual(['perfect', 'good', 'pending']);
    expect(state.combo).toBe(2);
    expect(state.battery).toBeGreaterThan(0);
  });

  it('breaks the combo and rewards nothing when a tap is near no note', () => {
    let state = initialRhythmState(NOTES.length);
    ({ state } = applyTap(state, NOTES, 1000));
    const before = state;
    const result = applyTap(state, NOTES, 1500);
    expect(result.outcome).toEqual({ kind: 'mash' });
    expect(result.state.combo).toBe(0);
    expect(result.state.score).toBe(before.score);
    expect(result.state.battery).toBe(before.battery);
    expect(result.state.noteStates).toEqual(before.noteStates);
  });

  it('expires notes whose window has passed and finishes the song', () => {
    let state = initialRhythmState(NOTES.length);
    state = expireMissedNotes(state, NOTES, 3200);
    expect(state.misses).toBe(3);
    expect(isSongJudged(state)).toBe(true);
    expect(expireMissedNotes(state, NOTES, 9000)).toBe(state);
  });
});
