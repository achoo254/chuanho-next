import { describe, expect, it } from 'vitest';
import { type ArmLengths, malletHeadAt, reachInPlane, reachTarget } from './strike-reach';

const ARM: ArmLengths = { upper: 0.2, fore: 0.18, mallet: 0.5, wrist: -0.5 };

describe('reachInPlane', () => {
  it('puts the mallet head exactly on a reachable target', () => {
    for (const target of [
      { out: 0.6, up: -0.1 },
      { out: 0.55, up: 0.08 },
      { out: 0.7, up: -0.3 },
    ]) {
      const { upper, elbow } = reachInPlane(ARM, target);
      const head = malletHeadAt(ARM, upper, elbow);
      expect(head.out).toBeCloseTo(target.out, 6);
      expect(head.up).toBeCloseTo(target.up, 6);
    }
  });

  it('keeps the elbow above the line to the target (a downward strike, not an upward scoop)', () => {
    const target = { out: 0.6, up: -0.15 };
    const { upper } = reachInPlane(ARM, target);
    const towards = Math.atan2(target.out, -target.up);
    expect(upper).toBeGreaterThan(towards);
  });

  it('points at a target that is out of reach instead of failing', () => {
    const far = { out: 5, up: 0 };
    const { upper, elbow } = reachInPlane(ARM, far);
    expect(Number.isFinite(upper) && Number.isFinite(elbow)).toBe(true);
    const head = malletHeadAt(ARM, upper, elbow);
    expect(Math.atan2(head.out, -head.up)).toBeCloseTo(Math.PI / 2, 4);
  });
});

describe('reachTarget', () => {
  it('turns the swing plane towards a target in front of the shoulder', () => {
    const straightOut = reachTarget(ARM, 0.5, 0, -0.1);
    const inFront = reachTarget(ARM, 0.4, 0.3, -0.1);
    expect(straightOut.yaw).toBeCloseTo(0, 9);
    expect(inFront.yaw).toBeCloseTo(Math.atan2(0.3, 0.4), 9);
    // Same distance in the plane, so the same shoulder and elbow.
    expect(inFront.upper).toBeCloseTo(straightOut.upper, 9);
  });
});
