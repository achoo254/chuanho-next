import { describe, expect, it } from 'vitest';
import { YARD_WALK_BOUNDS } from '../scene/diorama-layout';
import { distance, segmentClear } from './yard-geometry';
import { BODY_CLEARANCE, createYardMap } from './yard-map';

const map = createYardMap();
const places = [...Object.values(map.spots), ...map.wanderPoints];

describe('the yard map', () => {
  it('keeps every spot and stroll point on the paved floor', () => {
    for (const point of [...places, ...map.waypoints]) {
      expect(point.x).toBeGreaterThanOrEqual(YARD_WALK_BOUNDS.minX);
      expect(point.x).toBeLessThanOrEqual(YARD_WALK_BOUNDS.maxX);
      expect(point.z).toBeGreaterThanOrEqual(YARD_WALK_BOUNDS.minZ);
      expect(point.z).toBeLessThanOrEqual(YARD_WALK_BOUNDS.maxZ);
    }
  });

  it('leaves the stroll points and corners clear of every prop', () => {
    for (const point of [...map.wanderPoints, ...map.waypoints]) {
      for (const obstacle of map.obstacles) expect(distance(point, obstacle)).toBeGreaterThanOrEqual(obstacle.r + BODY_CLEARANCE);
    }
  });

  it('routes between every pair of places without walking through a prop', () => {
    for (const from of places) {
      for (const to of places) {
        if (from === to) continue;
        const route = map.route(from, to);
        expect(route[route.length - 1]).toEqual({ x: to.x, z: to.z });
        let at = from;
        for (const point of route) {
          expect(segmentClear(at, point, map.obstacles, BODY_CLEARANCE)).toBe(true);
          at = point;
        }
      }
    }
  });
});
