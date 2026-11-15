import { describe, expect, it } from 'vitest';
import { BELL_RING_MS, BOW_COUNT, BOW_MS, BOW_START_MS, KNOCK_CYCLE_MS, KNOCK_TIMES_MS, MOTION_KINDS, bellRingDue, knockDue, motionAt, walkPhase, walkPoseAt } from './activity-motion';

const FRAME = 1000 / 60;

function countDue(due: (previous: number, now: number) => boolean, untilMs: number): number {
  let count = 0;
  let previous = 0;
  for (let t = FRAME; t <= untilMs; t += FRAME) {
    if (due(previous, t)) count += 1;
    previous = t;
  }
  return count;
}

describe('scene cues', () => {
  it('knocks the wooden fish four times per cycle, then rests', () => {
    expect(countDue(knockDue, KNOCK_CYCLE_MS * 3)).toBe(KNOCK_TIMES_MS.length * 3);
    expect(knockDue(KNOCK_CYCLE_MS - 100, KNOCK_CYCLE_MS - 50)).toBe(false);
  });

  it('rings the bell once', () => {
    expect(countDue(bellRingDue, 5000)).toBe(1);
    expect(bellRingDue(BELL_RING_MS - 10, BELL_RING_MS)).toBe(true);
  });
});

describe('scene motion', () => {
  it('bows three times while praying, and stands straight between bows', () => {
    let bows = 0;
    let down = false;
    for (let t = 0; t < BOW_START_MS + BOW_MS * (BOW_COUNT + 1); t += FRAME) {
      const lean = motionAt('pray', t).lean;
      if (!down && lean > 0.3) {
        bows += 1;
        down = true;
      } else if (down && lean < 0.05) down = false;
    }
    expect(bows).toBe(BOW_COUNT);
    expect(motionAt('pray', 0).lean).toBe(0);
  });

  it('keeps every offset small enough not to break the pose', () => {
    for (const kind of MOTION_KINDS) {
      for (let t = 0; t < 20_000; t += 97) {
        const m = motionAt(kind, t);
        for (const value of [m.lean, m.roll, m.headNod, m.headTurn, m.headTilt]) expect(Math.abs(value)).toBeLessThanOrEqual(0.7);
        expect(m.breathDepth).toBeGreaterThan(0);
      }
    }
    expect(motionAt('look', Number.NaN)).toEqual(motionAt('look', 0));
  });

  it('closes the eyes while listening to the bell', () => {
    expect(motionAt('bell', 200).face).toBeNull();
    expect(motionAt('bell', BELL_RING_MS + 400).face).toBe('calm');
  });
});

describe('walk cycle', () => {
  it('stands still at zero weight', () => {
    const pose = walkPoseAt(1.3, 0);
    for (const value of Object.values(pose)) expect(Math.abs(value)).toBe(0);
  });

  it('swings legs and arms opposite each other, one step per step length', () => {
    const pose = walkPoseAt(Math.PI / 2, 1);
    expect(pose.leftLeg).toBeGreaterThan(0);
    expect(pose.rightLeg).toBeLessThan(0);
    expect(Math.sign(pose.leftArm)).toBe(-Math.sign(pose.leftLeg));
    expect(walkPhase(0.17)).toBeCloseTo(Math.PI, 9);
  });
});
