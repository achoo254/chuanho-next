import { describe, expect, it } from 'vitest';
import { CAMERA_SHOTS, blendCameraShot, shotTargetFor } from './camera-shots';

describe('blendCameraShot', () => {
  it('runs from one shot to the other and clamps outside 0..1', () => {
    const { yard, sutra } = CAMERA_SHOTS;
    expect(blendCameraShot(yard, sutra, 0)).toEqual(yard);
    for (const t of [1, 2]) {
      const end = blendCameraShot(yard, sutra, t);
      expect(end.target.x).toBeCloseTo(sutra.target.x, 9);
      expect(end.target.z).toBeCloseTo(sutra.target.z, 9);
      expect(end.distanceScale).toBeCloseTo(sutra.distanceScale, 9);
    }
    expect(blendCameraShot(yard, sutra, 0.5).distanceScale).toBeCloseTo((yard.distanceScale + sutra.distanceScale) / 2, 9);
  });

  it('frames the yard as fitted, and every play shot closer and lower', () => {
    expect(CAMERA_SHOTS.yard.distanceScale).toBe(1);
    for (const id of ['drum', 'incense', 'sutra'] as const) {
      expect(CAMERA_SHOTS[id].distanceScale).toBeLessThan(1);
      expect(CAMERA_SHOTS[id].pitchOffset).toBeLessThan(0);
    }
  });
});

describe('shotTargetFor', () => {
  it('uses the portrait target on tall screens only', () => {
    const { sutra, drum } = CAMERA_SHOTS;
    expect(shotTargetFor(sutra, 0.46)).toEqual(sutra.portraitTarget);
    expect(shotTargetFor(sutra, 1.6)).toEqual(sutra.target);
    expect(shotTargetFor(drum, 0.46)).toEqual(drum.target);
  });
});
