/**
 * Flat geometry of the yard floor for the character's own walks: points on the ground (x, z), headings, round
 * obstacles, and the shortest obstacle-free route through a handful of waypoints (a small visibility graph). Pure,
 * so the routes are tested without a scene.
 *
 * Headings follow Babylon's turn about the vertical: a node turned by `yaw` faces (−sin yaw, −cos yaw), because the
 * character's front is −z. Yaw 0 therefore faces the camera.
 */

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

/** Something to walk around, as a circle on the floor. */
export interface Obstacle extends Vec2 {
  readonly r: number;
}

export const distance = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.z - a.z);

/** The yaw that faces from `from` towards `to` (the current yaw when they coincide). */
export function yawTowards(from: Vec2, to: Vec2, fallback = 0): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.hypot(dx, dz) < 1e-6) return fallback;
  return Math.atan2(-dx, -dz);
}

/** An angle folded into (−π, π]. */
export function wrapAngle(angle: number): number {
  const turned = angle % (Math.PI * 2);
  if (turned > Math.PI) return turned - Math.PI * 2;
  if (turned <= -Math.PI) return turned + Math.PI * 2;
  return turned;
}

/** Turns `from` towards `to` by at most `maxStep` radians, the short way round. */
export function turnTowards(from: number, to: number, maxStep: number): number {
  const delta = wrapAngle(to - from);
  if (Math.abs(delta) <= maxStep) return wrapAngle(to);
  return wrapAngle(from + Math.sign(delta) * maxStep);
}

/** Moves `from` straight towards `to` by at most `step`. */
export function stepTowards(from: Vec2, to: Vec2, step: number): Vec2 {
  const gap = distance(from, to);
  if (gap <= step || gap < 1e-9) return { x: to.x, z: to.z };
  const t = step / gap;
  return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
}

/** Shortest distance from point `p` to the segment a–b. */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lengthSq = abx * abx + abz * abz;
  const t = lengthSq < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSq));
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

const inside = (p: Vec2, o: Obstacle, clearance: number): boolean => distance(p, o) < o.r + clearance;

/**
 * True when a body of radius `clearance` can walk straight from a to b. An obstacle that already holds either end
 * (the character stands right at the bell to ring it) is ignored, so walking up to it or away from it is allowed.
 */
export function segmentClear(a: Vec2, b: Vec2, obstacles: readonly Obstacle[], clearance: number): boolean {
  return obstacles.every((o) => inside(a, o, clearance) || inside(b, o, clearance) || distanceToSegment(o, a, b) >= o.r + clearance);
}

/**
 * The shortest walk from `from` to `to` that keeps `clearance` away from every obstacle, passing through any of the
 * `waypoints`. Returns the points to visit after the start, ending with `to`; a straight line when nothing is in the
 * way, and also the straight line as a last resort when no route exists (better a brush past a prop than standing
 * still forever).
 */
export function findRoute(from: Vec2, to: Vec2, waypoints: readonly Vec2[], obstacles: readonly Obstacle[], clearance: number): Vec2[] {
  if (segmentClear(from, to, obstacles, clearance)) return [to];
  const nodes: Vec2[] = [from, ...waypoints, to];
  const goal = nodes.length - 1;
  const best = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const done = nodes.map(() => false);
  best[0] = 0;
  for (;;) {
    let current = -1;
    for (let i = 0; i < nodes.length; i += 1) {
      if (!done[i] && Number.isFinite(best[i] ?? Number.POSITIVE_INFINITY) && (current === -1 || (best[i] ?? 0) < (best[current] ?? 0))) current = i;
    }
    if (current === -1 || current === goal) break;
    done[current] = true;
    const here = nodes[current];
    if (!here) break;
    for (let next = 0; next < nodes.length; next += 1) {
      const there = nodes[next];
      if (done[next] || !there || !segmentClear(here, there, obstacles, clearance)) continue;
      const through = (best[current] ?? 0) + distance(here, there);
      if (through < (best[next] ?? Number.POSITIVE_INFINITY)) {
        best[next] = through;
        previous[next] = current;
      }
    }
  }
  if (!Number.isFinite(best[goal] ?? Number.POSITIVE_INFINITY)) return [to];
  const route: Vec2[] = [];
  for (let at = goal; at > 0; at = previous[at] ?? 0) {
    const node = nodes[at];
    if (node) route.unshift(node);
  }
  return route;
}
