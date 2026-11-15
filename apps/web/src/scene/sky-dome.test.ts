import { describe, expect, it } from 'vitest';
import { coverTopLayout } from './sky-dome';

describe('coverTopLayout', () => {
  it('stretches a picture taller than the window and pins its top edge to the top of the window', () => {
    const { scale, offsetY } = coverTopLayout(2.4, 1.2);
    expect(scale).toEqual([1, 2]);
    expect(offsetY).toBe(-1);
  });

  it('crops the sides when the window is narrower than the picture', () => {
    const { scale, offsetY } = coverTopLayout(0.5, 1.5);
    expect(scale[0]).toBeCloseTo(3);
    expect(scale[1]).toBe(1);
    expect(offsetY).toBe(0);
  });

  it('leaves the picture alone for a window of unknown size', () => {
    expect(coverTopLayout(0, 1.8)).toEqual({ scale: [1, 1], offsetY: 0 });
  });
});
