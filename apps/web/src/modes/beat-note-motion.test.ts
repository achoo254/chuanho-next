import { describe, expect, it } from 'vitest';
import {
  APPROACH_MS,
  BURST_MS,
  TRAIL_STEPS,
  approachRing,
  beatPulse,
  burstFlash,
  burstPetal,
  burstSparkle,
  isAccentNote,
  trailStep,
} from './beat-note-motion';

describe('beatPulse', () => {
  it('peaks on the beat and fades before the next one', () => {
    expect(beatPulse(1000, 500)).toBeCloseTo(1);
    expect(beatPulse(1100, 500)).toBeLessThan(beatPulse(1050, 500));
    expect(beatPulse(1499, 500)).toBeLessThan(0.02);
  });
  it('is quiet before the song and for a broken beat length', () => {
    expect(beatPulse(-10, 500)).toBe(0);
    expect(beatPulse(Number.NaN, 500)).toBe(0);
    expect(beatPulse(100, 0)).toBe(0);
  });
});

describe('isAccentNote', () => {
  it('marks the first beat of each four-beat bar', () => {
    expect(isAccentNote(0, 500)).toBe(true);
    expect(isAccentNote(2000, 500)).toBe(true);
    expect(isAccentNote(500, 500)).toBe(false);
    expect(isAccentNote(1999.9999, 500)).toBe(true);
  });
});

describe('approachRing', () => {
  it('closes from wide and faint to the halo size as the note lands', () => {
    const early = approachRing(APPROACH_MS - 1);
    const late = approachRing(10);
    expect(early.scale).toBeGreaterThan(late.scale);
    expect(early.alpha).toBeLessThan(late.alpha);
    expect(approachRing(0).scale).toBeCloseTo(1);
  });
  it('is hidden outside its window', () => {
    expect(approachRing(APPROACH_MS + 1).alpha).toBe(0);
    expect(approachRing(-1).alpha).toBe(0);
    expect(approachRing(Number.POSITIVE_INFINITY).alpha).toBe(0);
  });
});

describe('trailStep', () => {
  it('trails further back, smaller and fainter at each step', () => {
    for (let step = 1; step < TRAIL_STEPS; step += 1) {
      const before = trailStep(step - 1);
      const now = trailStep(step);
      expect(now.lag).toBeGreaterThan(before.lag);
      expect(now.scale).toBeLessThan(before.scale);
      expect(now.alpha).toBeLessThan(before.alpha);
    }
  });
});

describe('bursts', () => {
  it('throws petals out and lets them fall back, then ends', () => {
    const early = burstPetal(0, 10, 80, false);
    const late = burstPetal(0, 10, BURST_MS - 40, false);
    expect(early && late).toBeTruthy();
    if (!early || !late) return;
    expect(Math.hypot(late.x, late.z)).toBeGreaterThan(Math.hypot(early.x, early.z));
    expect(late.y).toBeLessThan(0.2);
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(burstPetal(0, 10, BURST_MS, false)).toBeNull();
    expect(burstPetal(0, 0, 10, false)).toBeNull();
  });
  it('keeps petals and sparkles in place with reduced motion', () => {
    const petal = burstPetal(3, 10, 300, true);
    const sparkle = burstSparkle(2, 6, 200, true);
    expect(petal?.x).toBeCloseTo(0);
    expect(petal?.y).toBeCloseTo(0);
    expect(sparkle?.x).toBeCloseTo(0);
  });
  it('flashes bright at once and is gone by mid-burst', () => {
    expect(burstFlash(0).alpha).toBe(1);
    expect(burstFlash(BURST_MS * 0.5).alpha).toBe(0);
    expect(burstFlash(-5).alpha).toBe(0);
  });
});
