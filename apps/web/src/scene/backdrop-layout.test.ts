import { describe, expect, it } from 'vitest';
import {
  BAMBOO_CLUMPS,
  BLOSSOM_TREES,
  PLINTH_CLEAR,
  PONDS,
  PUFFY_TREES,
  STEPPING_STONES,
  STREAM_CONTROL,
  STREAM_PATH,
  distanceToPolyline,
  insideEllipse,
  lawnVariation,
  offsetPolyline,
  onWater,
  pointsInside,
  rimPoints,
  sampleCurve,
  scatter,
  scatterClusters,
  seededRandom,
} from './backdrop-layout';

const PLINTH = { x: 0, z: 0, rx: 9.5, rz: 7.75 };

describe('seededRandom', () => {
  it('repeats for the same seed and stays in 0..1', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 200; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('geometry helpers', () => {
  it('tests points against a grown ellipse', () => {
    const e = { x: 2, z: 1, rx: 3, rz: 1 };
    expect(insideEllipse(e, 4.9, 1)).toBe(true);
    expect(insideEllipse(e, 5.1, 1)).toBe(false);
    expect(insideEllipse(e, 2, 2.4, 0.5)).toBe(true);
  });

  it('passes the curve through every control point', () => {
    const control = [
      [0, 0],
      [4, 2],
      [8, 0],
    ] as const;
    const curve = sampleCurve(control, 5);
    expect(curve).toHaveLength(11);
    expect(curve[0]).toEqual([0, 0]);
    expect(curve[5]?.[0]).toBeCloseTo(4);
    expect(curve[5]?.[1]).toBeCloseTo(2);
    expect(curve[10]).toEqual([8, 0]);
  });

  it('measures the distance to a polyline and offsets it sideways', () => {
    const line = [
      [0, 0],
      [10, 0],
    ] as const;
    expect(distanceToPolyline(line, 5, 3)).toBeCloseTo(3);
    expect(distanceToPolyline(line, -4, 3)).toBeCloseTo(5);
    const left = offsetPolyline(line, 2);
    expect(left[0]?.[1]).toBeCloseTo(2);
    expect(left[1]?.[1]).toBeCloseTo(2);
  });

  it('keeps the lawn shading within 0..1', () => {
    for (let x = -80; x <= 80; x += 7) {
      for (let z = -80; z <= 80; z += 7) {
        const v = lawnVariation(x, z);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('scatter', () => {
  const options = { count: 40, seed: 9, inner: PLINTH_CLEAR, outerRadius: 30, minSpacing: 2, avoid: (x: number, z: number) => onWater(x, z, 1), scale: [1, 2] as const };

  it('is deterministic and keeps out of the clear ring, the water and each other', () => {
    const points = scatter(options);
    expect(points).toEqual(scatter(options));
    expect(points.length).toBeGreaterThan(20);
    for (const p of points) {
      expect(insideEllipse(PLINTH_CLEAR, p.x, p.z)).toBe(false);
      expect(onWater(p.x, p.z, 1)).toBe(false);
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(30);
      expect(p.scale).toBeGreaterThanOrEqual(1);
      expect(p.scale).toBeLessThanOrEqual(2);
    }
    for (const a of points) for (const b of points) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(2);
  });

  it('returns fewer points rather than looping when the ring is full', () => {
    expect(scatter({ ...options, count: 5000, minSpacing: 6 }).length).toBeLessThan(5000);
  });

  it('drops cluster flowers that would land on water or in the clear ring', () => {
    const flowers = scatterClusters({ ...options, count: 12 }, 8, 2);
    expect(flowers.length).toBeGreaterThan(30);
    for (const f of flowers) {
      expect(insideEllipse(PLINTH_CLEAR, f.x, f.z)).toBe(false);
      expect(onWater(f.x, f.z, 1)).toBe(false);
    }
  });

  it('puts rim points around a pond and pads inside it', () => {
    const pond = PONDS[0];
    if (!pond) throw new Error('no pond');
    for (const p of rimPoints(pond, 20, 3, 0.5, [1, 1])) expect(insideEllipse(pond, p.x, p.z, -0.2)).toBe(false);
    for (const p of pointsInside(pond, 15, 3, 1, [1, 1])) expect(insideEllipse(pond, p.x, p.z)).toBe(true);
  });
});

describe('garden layout', () => {
  it('keeps trees and bamboo off the water and out of the clear ring', () => {
    for (const t of [...BAMBOO_CLUMPS, ...PUFFY_TREES, ...BLOSSOM_TREES]) {
      expect(insideEllipse(PLINTH_CLEAR, t.x, t.z)).toBe(false);
      expect(onWater(t.x, t.z, 1)).toBe(false);
    }
  });

  it('keeps the water and the stepping stones off the plinth', () => {
    for (const pond of PONDS) {
      for (let a = 0; a < Math.PI * 2; a += 0.2) {
        expect(insideEllipse(PLINTH_CLEAR, pond.x + Math.cos(a) * pond.rx, pond.z + Math.sin(a) * pond.rz)).toBe(false);
      }
    }
    for (const [x, z] of STREAM_PATH) expect(insideEllipse(PLINTH_CLEAR, x, z, 2)).toBe(false);
    for (const [x, z] of STEPPING_STONES) expect(insideEllipse(PLINTH, x, z, 0.6)).toBe(false);
  });

  it('ends the stream inside the big pond', () => {
    const end = STREAM_CONTROL[STREAM_CONTROL.length - 1];
    const pond = PONDS[0];
    if (!end || !pond) throw new Error('layout is empty');
    expect(insideEllipse(pond, end[0], end[1])).toBe(true);
  });
});
