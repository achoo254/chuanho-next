import { describe, expect, it } from 'vitest';
import { type DioramaExtent, fitDioramaCamera, orbitPosition } from './fit-diorama-camera';

const YARD: DioramaExtent = { halfWidth: 9.5, halfDepth: 7.8, height: 7.2 };

/** Half the visible width and height of a frame at the target's distance. */
function visibleHalfExtents(aspect: number): { halfWidth: number; halfHeight: number } {
  const frame = fitDioramaCamera(aspect, YARD);
  const halfHeight = Math.tan(frame.fov / 2) * frame.distance;
  return { halfWidth: halfHeight * aspect, halfHeight };
}

describe('fitDioramaCamera', () => {
  it('looks down more steeply and with a wider lens on a tall phone than on a computer', () => {
    const phone = fitDioramaCamera(390 / 844, YARD);
    const desktop = fitDioramaCamera(1440 / 900, YARD);
    expect(phone.pitch).toBeGreaterThan(desktop.pitch);
    expect(phone.fov).toBeGreaterThan(desktop.fov);
    expect(phone.distance).toBeGreaterThan(desktop.distance);
  });

  it('shows the whole yard width on a landscape window', () => {
    for (const aspect of [1.6, 16 / 9, 2]) {
      expect(visibleHalfExtents(aspect).halfWidth).toBeGreaterThanOrEqual(YARD.halfWidth);
    }
  });

  it('crops at most the decorative edges on a tall phone', () => {
    const { halfWidth } = visibleHalfExtents(390 / 844);
    expect(halfWidth).toBeGreaterThanOrEqual(YARD.halfWidth * 0.64);
    expect(halfWidth).toBeLessThan(YARD.halfWidth);
  });

  it('lets the height decide on an ultra-wide window so the yard does not shrink to a strip', () => {
    const wide = fitDioramaCamera(16 / 9, YARD);
    const ultraWide = fitDioramaCamera(32 / 9, YARD);
    expect(ultraWide.distance).toBeCloseTo(wide.distance, 1);
    expect(visibleHalfExtents(32 / 9).halfWidth).toBeGreaterThan(YARD.halfWidth * 1.5);
  });

  it('treats a broken aspect ratio (hidden or zero-size window) as square', () => {
    expect(fitDioramaCamera(0, YARD)).toEqual(fitDioramaCamera(1, YARD));
    expect(fitDioramaCamera(Number.NaN, YARD)).toEqual(fitDioramaCamera(1, YARD));
  });

  it('keeps every frame finite and positive for any window shape', () => {
    for (const aspect of [0.2, 0.46, 0.75, 1, 1.33, 1.78, 2.4, 3.6, 8]) {
      const frame = fitDioramaCamera(aspect, YARD);
      expect(Number.isFinite(frame.distance)).toBe(true);
      expect(frame.distance).toBeGreaterThan(0);
      expect(frame.pitch).toBeGreaterThan(0);
      expect(frame.pitch).toBeLessThan(Math.PI / 2);
    }
  });
});

describe('orbitPosition', () => {
  it('places the camera in front of and above the target at the given distance', () => {
    const target = { x: 0, y: 1, z: 0 };
    const position = orbitPosition(target, 0, Math.PI / 4, 10);
    expect(position.x).toBeCloseTo(0);
    expect(position.y).toBeCloseTo(1 + 10 * Math.SQRT1_2);
    expect(position.z).toBeCloseTo(-10 * Math.SQRT1_2);
    const offset = Math.hypot(position.x - target.x, position.y - target.y, position.z - target.z);
    expect(offset).toBeCloseTo(10);
  });

  it('swings sideways with the yaw', () => {
    const right = orbitPosition({ x: 0, y: 0, z: 0 }, 0.3, 0.6, 10);
    const left = orbitPosition({ x: 0, y: 0, z: 0 }, -0.3, 0.6, 10);
    expect(right.x).toBeCloseTo(-left.x);
    expect(right.z).toBeCloseTo(left.z);
  });
});
