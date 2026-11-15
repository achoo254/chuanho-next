/**
 * The yard as the character's walks see it: its named spots, the open points to stroll to, the corners to route
 * through and the round footprints of the props, all read from the yard's layout data so moving a prop moves its
 * footprint too.
 */
import {
  CHARACTER_SPOTS,
  type CharacterSpotId,
  DIORAMA_LAYOUT,
  YARD_OBSTACLE_RADII,
  YARD_WALK_BOUNDS,
  YARD_WANDER_POINTS,
  YARD_WAYPOINTS,
} from '../scene/diorama-layout';
import { type Obstacle, type Vec2, findRoute } from './yard-geometry';

/** Half the character's width plus a little air: how far its centre keeps from a prop's footprint. */
export const BODY_CLEARANCE = 0.4;
/** The meditation cushion's footprint (it sits on the meditation spot). */
export const CUSHION_RADIUS = 0.5;

export interface Spot extends Vec2 {
  readonly yaw: number;
}

export interface YardMap {
  readonly spots: Readonly<Record<CharacterSpotId, Spot>>;
  readonly wanderPoints: readonly Vec2[];
  readonly waypoints: readonly Vec2[];
  readonly obstacles: readonly Obstacle[];
  /** The walk from a point to another, as the points to visit after the start. */
  route(from: Vec2, to: Vec2): Vec2[];
}

const toVec = ([x, z]: readonly [number, number]): Vec2 => ({ x, z });

export function clampToYard(point: Vec2): Vec2 {
  return {
    x: Math.max(YARD_WALK_BOUNDS.minX, Math.min(YARD_WALK_BOUNDS.maxX, point.x)),
    z: Math.max(YARD_WALK_BOUNDS.minZ, Math.min(YARD_WALK_BOUNDS.maxZ, point.z)),
  };
}

export function createYardMap(): YardMap {
  const spots = Object.fromEntries(
    (Object.entries(CHARACTER_SPOTS) as Array<[CharacterSpotId, (typeof CHARACTER_SPOTS)[CharacterSpotId]]>).map(([id, spot]) => [
      id,
      { x: spot.position[0], z: spot.position[2], yaw: spot.rotationY },
    ]),
  ) as Record<CharacterSpotId, Spot>;
  const obstacles: Obstacle[] = [];
  for (const placement of DIORAMA_LAYOUT) {
    const radius = YARD_OBSTACLE_RADII[placement.asset];
    // Only props standing on the yard floor (the pillars stand up on the hall's platform).
    if (radius === undefined || placement.position[1] > 0.1) continue;
    obstacles.push({ x: placement.position[0], z: placement.position[2], r: radius * (placement.scale ?? 1) });
  }
  obstacles.push({ x: spots.meditate.x, z: spots.meditate.z, r: CUSHION_RADIUS });
  const waypoints = YARD_WAYPOINTS.map(toVec);
  return {
    spots,
    wanderPoints: YARD_WANDER_POINTS.map(toVec),
    waypoints,
    obstacles,
    route: (from, to) => findRoute(clampToYard(from), clampToYard(to), waypoints, obstacles, BODY_CLEARANCE),
  };
}
