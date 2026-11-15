/**
 * Where each Mõ Beat note flies: a glowing orb rises from behind the wooden fish, arcs over and lands on its top
 * exactly at the note's time, so the wooden fish itself is the hit line. Each note gets its own start point
 * (spread round the wooden fish by the golden angle) so a run of notes reads as separate orbs, not one stream.
 * Pure: the same note and time always give the same place.
 */

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Flight time from appearing to landing. */
export const ORB_FLIGHT_MS = 1600;
/** A note still unjudged just after its time keeps sitting on the wooden fish for this long (then the judge expires it). */
export const ORB_LINGER_MS = 160;

const GOLDEN_ANGLE = 2.399963;
/** The start points sit on an arc behind the wooden fish (away from the camera, +z), never in front of it. */
const START_RADIUS = 1.5;
const START_HEIGHT = 0.9;
const ARC_HEIGHT = 0.6;
const MAX_SPREAD = 1.1; // radians either side of straight behind

export function orbStartPoint(target: Point3, noteIndex: number): Point3 {
  const angle = Math.sin(noteIndex * GOLDEN_ANGLE) * MAX_SPREAD;
  return {
    x: target.x + Math.sin(angle) * START_RADIUS,
    y: target.y + START_HEIGHT,
    z: target.z + Math.cos(angle) * START_RADIUS,
  };
}

/** Quadratic Bézier between `from` and `to` through the pull of `control`, at `t` in 0..1. */
export function quadraticBezier(from: Point3, control: Point3, to: Point3, t: number): Point3 {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
    z: u * u * from.z + 2 * u * t * control.z + t * t * to.z,
  };
}

export interface OrbPlacement {
  readonly visible: boolean;
  /** 0 when it appears, 1 when it lands (time runs linearly, so the landing is exactly on the note). */
  readonly progress: number;
  readonly position: Point3;
}

const HIDDEN: OrbPlacement = { visible: false, progress: 0, position: { x: 0, y: 0, z: 0 } };

/**
 * The orb of note `noteIndex`, `aheadMs` before its time (negative once the time has passed). Hidden before it
 * appears and once it has lingered past its time.
 */
export function noteOrbPlacement(aheadMs: number, noteIndex: number, target: Point3): OrbPlacement {
  if (!Number.isFinite(aheadMs) || aheadMs > ORB_FLIGHT_MS || aheadMs < -ORB_LINGER_MS) return HIDDEN;
  const progress = Math.min(1, 1 - aheadMs / ORB_FLIGHT_MS);
  const from = orbStartPoint(target, noteIndex);
  const control = { x: (from.x + target.x) / 2, y: Math.max(from.y, target.y) + ARC_HEIGHT, z: (from.z + target.z) / 2 };
  return { visible: true, progress, position: quadraticBezier(from, control, target, progress) };
}
