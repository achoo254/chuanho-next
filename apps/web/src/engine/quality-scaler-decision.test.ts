import { describe, expect, it } from 'vitest';
import { DEFAULT_SCALER_CONFIG, type ScalerState, initialScalerState, stepQualityScaler } from './quality-scaler-decision';
import { QUALITY_LEVELS, TOP_QUALITY_LEVEL, qualityIndexOf, qualityLevelAt, startingQualityLevel } from './quality-levels';
import { pinnedQuality } from './game-3d-flag';

/** Runs `frames` frames of `frameMs` each and returns the final state and every change made on the way. */
function run(state: ScalerState, frameMs: number, frames: number): { state: ScalerState; changes: number[] } {
  const changes: number[] = [];
  let current = state;
  for (let i = 0; i < frames; i += 1) {
    const step = stepQualityScaler(current, frameMs);
    if (step.change !== 0) changes.push(step.change);
    current = step.state;
  }
  return { state: current, changes };
}

describe('stepQualityScaler', () => {
  it('stays put while frames keep up but there is no higher rung', () => {
    const { state, changes } = run(initialScalerState(3, 3), 16.7, 2000);
    expect(changes).toEqual([]);
    expect(state.level).toBe(3);
  });

  it('steps down after slow frames last a little over a second', () => {
    const start = initialScalerState(2, 3);
    const short = run(start, 33, 20); // about 0.66 s of 30 fps
    expect(short.changes).toEqual([]);
    const longer = run(start, 33, 60); // about 2 s
    expect(longer.changes).toEqual([-1]);
    expect(longer.state.level).toBe(1);
  });

  it('keeps stepping down, one rung per cooldown, and never below the lowest rung', () => {
    const { state, changes } = run(initialScalerState(3, 3), 50, 600); // 30 s at 20 fps
    expect(changes).toEqual([-1, -1, -1]);
    expect(state.level).toBe(0);
  });

  it('climbs back slowly after keeping up for several seconds', () => {
    const start = initialScalerState(1, 3);
    expect(run(start, 16.7, 300).changes).toEqual([]); // 5 s is not enough
    const { state, changes } = run(start, 16.7, 600); // 10 s
    expect(changes).toEqual([1]);
    expect(state.level).toBe(2);
  });

  it('lowers the ceiling when a climb fails soon after, so it does not see-saw', () => {
    let state = initialScalerState(1, 3);
    state = run(state, 16.7, 600).state; // climbs to 2
    expect(state.level).toBe(2);
    state = run(state, 40, 100).state; // rung 2 is too slow: back to 1
    expect(state.level).toBe(1);
    expect(state.ceiling).toBe(1);
    const later = run(state, 16.7, 3000); // a long calm stretch does not retry rung 2
    expect(later.changes).toEqual([]);
    expect(later.state.level).toBe(1);
  });

  it('ignores huge frames from a hidden tab or a pause instead of averaging them', () => {
    const start = initialScalerState(2, 3);
    const step = stepQualityScaler(start, 5000);
    expect(step.change).toBe(0);
    expect(step.state).toBe(start);
    expect(stepQualityScaler(start, Number.NaN).state).toBe(start);
    expect(stepQualityScaler(start, -3).state).toBe(start);
  });

  it('waits out the cooldown after a change before deciding again', () => {
    const afterDrop = run(initialScalerState(3, 3), 40, 40).state;
    expect(afterDrop.level).toBe(2);
    expect(afterDrop.cooldownMs).toBeGreaterThan(0);
    const during = run(afterDrop, 40, Math.floor(DEFAULT_SCALER_CONFIG.cooldownMs / 40) - 1);
    expect(during.changes).toEqual([]);
  });
});

describe('quality levels', () => {
  it('grow more expensive rung by rung', () => {
    for (let i = 1; i < QUALITY_LEVELS.length; i += 1) {
      const lower = qualityLevelAt(i - 1);
      const higher = qualityLevelAt(i);
      expect(higher.maxPixelRatio).toBeGreaterThanOrEqual(lower.maxPixelRatio);
      expect(higher.shadowMapSize).toBeGreaterThanOrEqual(lower.shadowMapSize);
    }
  });

  it('clamps out-of-range rungs and starts phones lower than computers', () => {
    expect(qualityLevelAt(-4).id).toBe('low');
    expect(qualityLevelAt(99)).toBe(qualityLevelAt(TOP_QUALITY_LEVEL));
    expect(startingQualityLevel(true)).toBeLessThan(startingQualityLevel(false));
  });

  it('can be pinned from the address for testing', () => {
    expect(qualityIndexOf(pinnedQuality('?v=3d&quality=high'))).toBe(2);
    expect(qualityIndexOf(pinnedQuality('?v=3d&quality=max'))).toBeNull();
    expect(qualityIndexOf(pinnedQuality('?v=3d'))).toBeNull();
  });
});
