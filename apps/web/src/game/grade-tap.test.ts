import { describe, expect, it } from 'vitest';
import { GOOD_WINDOW_MS, PERFECT_WINDOW_MS, gradeTap } from './grade-tap';

describe('gradeTap', () => {
  it('grades a tap on the note as perfect', () => {
    expect(gradeTap(0)).toBe('perfect');
  });

  it('keeps the perfect window inclusive on both sides', () => {
    expect(gradeTap(PERFECT_WINDOW_MS)).toBe('perfect');
    expect(gradeTap(-PERFECT_WINDOW_MS)).toBe('perfect');
    expect(gradeTap(PERFECT_WINDOW_MS + 1)).toBe('good');
    expect(gradeTap(-(PERFECT_WINDOW_MS + 1))).toBe('good');
  });

  it('keeps the good window inclusive and misses beyond it', () => {
    expect(gradeTap(GOOD_WINDOW_MS)).toBe('good');
    expect(gradeTap(-GOOD_WINDOW_MS)).toBe('good');
    expect(gradeTap(GOOD_WINDOW_MS + 1)).toBe('miss');
    expect(gradeTap(-500)).toBe('miss');
  });

  it('treats a non-number delta as a miss', () => {
    expect(gradeTap(Number.NaN)).toBe('miss');
    expect(gradeTap(Number.POSITIVE_INFINITY)).toBe('miss');
  });
});
