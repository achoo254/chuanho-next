import { describe, expect, it } from 'vitest';
import { ORB_FLIGHT_MS, ORB_LINGER_MS, noteOrbPlacement, orbStartPoint, quadraticBezier } from './note-orb-path';

const TOP = { x: 0.8, y: 0.6, z: -3 };

describe('quadraticBezier', () => {
  it('starts and ends on its end points', () => {
    const a = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 5, z: 1 };
    const b = { x: 2, y: 0, z: 2 };
    expect(quadraticBezier(a, c, b, 0)).toEqual(a);
    expect(quadraticBezier(a, c, b, 1)).toEqual(b);
    expect(quadraticBezier(a, c, b, 0.5).y).toBeCloseTo(2.5, 9);
  });
});

describe('noteOrbPlacement', () => {
  it('appears at its start point one flight before the note', () => {
    const placement = noteOrbPlacement(ORB_FLIGHT_MS, 3, TOP);
    expect(placement.visible).toBe(true);
    expect(placement.progress).toBe(0);
    const start = orbStartPoint(TOP, 3);
    expect(placement.position.x).toBeCloseTo(start.x, 9);
    expect(placement.position.y).toBeCloseTo(start.y, 9);
  });

  it('lands exactly on top of the wooden fish at the note time', () => {
    const placement = noteOrbPlacement(0, 7, TOP);
    expect(placement.progress).toBe(1);
    expect(placement.position.x).toBeCloseTo(TOP.x, 9);
    expect(placement.position.y).toBeCloseTo(TOP.y, 9);
    expect(placement.position.z).toBeCloseTo(TOP.z, 9);
  });

  it('is hidden before it appears and after it has lingered', () => {
    expect(noteOrbPlacement(ORB_FLIGHT_MS + 1, 0, TOP).visible).toBe(false);
    expect(noteOrbPlacement(-ORB_LINGER_MS - 1, 0, TOP).visible).toBe(false);
    expect(noteOrbPlacement(-ORB_LINGER_MS / 2, 0, TOP).visible).toBe(true);
    expect(noteOrbPlacement(Number.NaN, 0, TOP).visible).toBe(false);
  });

  it('gets closer to the landing point as the note approaches', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let ahead = ORB_FLIGHT_MS; ahead >= 0; ahead -= 100) {
      const p = noteOrbPlacement(ahead, 2, TOP).position;
      const horizontal = Math.hypot(p.x - TOP.x, p.z - TOP.z);
      expect(horizontal).toBeLessThanOrEqual(previous + 1e-9);
      previous = horizontal;
    }
  });

  it('starts every orb behind the wooden fish, spread apart', () => {
    const starts = [0, 1, 2, 3].map((index) => orbStartPoint(TOP, index));
    for (const start of starts) expect(start.z).toBeGreaterThan(TOP.z);
    expect(new Set(starts.map((s) => s.x.toFixed(3))).size).toBe(4);
  });
});
