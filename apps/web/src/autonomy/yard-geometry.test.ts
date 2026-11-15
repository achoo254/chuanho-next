import { describe, expect, it } from 'vitest';
import { type Obstacle, distance, distanceToSegment, findRoute, segmentClear, stepTowards, turnTowards, wrapAngle, yawTowards } from './yard-geometry';

describe('headings', () => {
  it('faces the camera (−z) at yaw 0 and turns the Babylon way', () => {
    expect(yawTowards({ x: 0, z: 0 }, { x: 0, z: -1 })).toBeCloseTo(0, 9);
    // Facing +x: (−sin yaw, −cos yaw) = (1, 0).
    expect(yawTowards({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(-Math.PI / 2, 9);
    expect(yawTowards({ x: 1, z: 1 }, { x: 1, z: 1 }, 0.7)).toBe(0.7);
  });

  it('wraps angles into (−π, π] and turns the short way round', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(turnTowards(3, -3, 0.1)).toBeCloseTo(wrapAngle(3.1), 9);
    expect(turnTowards(0, 0.05, 0.1)).toBeCloseTo(0.05, 9);
  });

  it('steps towards a point without overshooting', () => {
    const step = stepTowards({ x: 0, z: 0 }, { x: 3, z: 4 }, 1);
    expect(step.x).toBeCloseTo(0.6, 9);
    expect(step.z).toBeCloseTo(0.8, 9);
    expect(stepTowards({ x: 0, z: 0 }, { x: 3, z: 4 }, 10)).toEqual({ x: 3, z: 4 });
  });
});

describe('routes around props', () => {
  const pillar: Obstacle = { x: 0, z: 0, r: 1 };

  it('measures the distance to a segment', () => {
    expect(distanceToSegment({ x: 0, z: 1 }, { x: -1, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(1, 9);
    expect(distanceToSegment({ x: 3, z: 0 }, { x: -1, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(2, 9);
  });

  it('walks straight when nothing is in the way', () => {
    expect(findRoute({ x: -3, z: 3 }, { x: 3, z: 3 }, [], [pillar], 0.3)).toEqual([{ x: 3, z: 3 }]);
  });

  it('goes around an obstacle through waypoints, every leg clear', () => {
    const from = { x: -3, z: 0 };
    const to = { x: 3, z: 0 };
    const waypoints = [
      { x: -1.5, z: 1.8 },
      { x: 1.5, z: 1.8 },
      { x: 0, z: -5 },
    ];
    const route = findRoute(from, to, waypoints, [pillar], 0.3);
    expect(route).toEqual([waypoints[0], waypoints[1], to]);
    let at = from;
    for (const point of route) {
      expect(segmentClear(at, point, [pillar], 0.3)).toBe(true);
      at = point;
    }
  });

  it('may walk up to and away from a prop it stands right next to', () => {
    expect(segmentClear({ x: 1.1, z: 0 }, { x: 4, z: 0 }, [pillar], 0.3)).toBe(true);
    expect(segmentClear({ x: -3, z: 0 }, { x: 3, z: 0 }, [pillar], 0.3)).toBe(false);
  });

  it('falls back to the straight line when no route exists', () => {
    expect(findRoute({ x: -3, z: 0 }, { x: 3, z: 0 }, [], [pillar], 0.3)).toEqual([{ x: 3, z: 0 }]);
    expect(distance({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });
});
