import { describe, expect, it } from 'vitest';
import { RESET_STROKES, addStroke, doneStepCount, firstOpenStep, isResetComplete, nextOpenStep, strokeFraction } from './release-steps';

const flags = (reset: boolean, apology: boolean, deed: boolean): { released: { reset: boolean; apology: boolean; deed: boolean } } => ({ released: { reset, apology, deed } });

describe('release order', () => {
  it('opens on the first step not done yet', () => {
    expect(firstOpenStep(flags(false, false, false))).toBe('reset');
    expect(firstOpenStep(flags(true, false, true))).toBe('apology');
    expect(firstOpenStep(flags(true, true, true))).toBeNull();
  });

  it('moves on to the next open step after a done or skipped one, never back', () => {
    expect(nextOpenStep(flags(false, false, false), 'reset')).toBe('apology');
    expect(nextOpenStep(flags(false, true, false), 'reset')).toBe('deed');
    expect(nextOpenStep(flags(false, false, false), 'deed')).toBeNull();
    expect(nextOpenStep(flags(false, false, true), 'apology')).toBeNull();
  });

  it('counts the steps done', () => {
    expect(doneStepCount(flags(true, false, true))).toBe(2);
  });
});

describe('reset strokes', () => {
  it('counts up to 21 and stops there', () => {
    let count = 0;
    for (let i = 0; i < 30; i += 1) count = addStroke(count);
    expect(count).toBe(RESET_STROKES);
    expect(isResetComplete(count)).toBe(true);
    expect(isResetComplete(20)).toBe(false);
  });

  it('fills the ring between 0 and 1', () => {
    expect(strokeFraction(0)).toBe(0);
    expect(strokeFraction(21)).toBe(1);
    expect(strokeFraction(99)).toBe(1);
    expect(strokeFraction(-3)).toBe(0);
  });
});
