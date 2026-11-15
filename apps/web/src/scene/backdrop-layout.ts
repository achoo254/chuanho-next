/**
 * Where the garden around the plinth puts things, as plain data and pure helpers (no engine, unit tested): the two
 * lotus ponds, the stream that winds behind the temple into the big pond, stepping stones, and the hand-placed trees
 * and bamboo. Small repeated bits (bushes, flowers, pebbles, lily pads) are scattered by a seeded generator so the
 * garden looks the same on every visit and never lands on water or inside the clear ring around the plinth.
 *
 * The camera looks from −z towards +z; the ground the player sees most is behind and beside the plinth.
 */

/** The lawn's height: a little above the plinth's underside, so the plinth looks set into the grass. */
export const GROUND_Y = -0.9;

export type Point = readonly [number, number];

/** An axis-aligned ellipse on the ground (x, z centre and radii). */
export interface GroundEllipse {
  readonly x: number;
  readonly z: number;
  readonly rx: number;
  readonly rz: number;
}

/** The plinth (19 × 15.5) plus breathing room: nothing taller than a flower stands inside it. */
export const PLINTH_CLEAR: GroundEllipse = { x: 0, z: 0, rx: 10.6, rz: 8.7 };

/**
 * The big lotus pond behind the hall on the left (the stream ends in it) and a small one beside the plinth on the
 * right. The camera sees a band behind the hall on every screen and the sides only on wide ones, so the showpieces
 * sit behind the hall and the sides get the extras.
 */
export const PONDS: readonly GroundEllipse[] = [
  { x: -11, z: 17, rx: 6.5, rz: 4.5 },
  { x: 15.5, z: -2.5, rx: 4.2, rz: 3.2 },
];

/** Control points of the stream, from beyond the far right corner to inside the big pond. */
export const STREAM_CONTROL: readonly Point[] = [
  [34, 36],
  [21, 27],
  [10, 21.5],
  [2, 21.8],
  [-7, 18.5],
];
export const STREAM_HALF_WIDTH = 1.1;

/** Stepping stones: from the plinth's left edge to the big pond, and across the stream behind the hall. */
export const STEPPING_STONES: readonly Point[] = [
  [-10.0, 5.2],
  [-10.6, 7.3],
  [-10.9, 9.4],
  [-11.0, 11.4],
  [4.7, 20.1],
  [5.3, 21.6],
  [4.9, 23.1],
];

export interface Placement {
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  /** Turn about the vertical, radians. */
  readonly yaw: number;
}

const place = (x: number, z: number, scale: number, yaw = 0): Placement => ({ x, z, scale, yaw });

/** Bamboo clumps frame the sides and the back. */
export const BAMBOO_CLUMPS: readonly Placement[] = [
  place(-16.5, 5.5, 1.1, 0.4),
  place(14.5, 13, 1.05, 2.2),
  place(-1.5, 29, 1.2, 0.9),
  place(22, 19, 1.2, 2.9),
  place(-23, 24, 1.25, 1.3),
  place(25, 3, 1.1, 1.7),
];

/** Round mint trees. */
export const PUFFY_TREES: readonly Placement[] = [
  place(-20, 14, 1.15, 0.3),
  place(10, 28, 1.3, 1.1),
  place(19, 7.5, 1.1, 2.0),
  place(-9, 28.5, 1.2, 2.6),
  place(-28, 6, 1.2, 0.7),
  place(30, 13, 1.25, 1.5),
  place(-4, 36, 1.3, 0.2),
];

/** Pink blossom trees, the cheerful accents. */
export const BLOSSOM_TREES: readonly Placement[] = [
  place(-14.5, -1.5, 0.95, 0.5),
  place(13.5, 6, 0.9, 1.9),
  place(3.5, 30, 1.15, 0.8),
  place(-20, 26, 1.1, 1.2),
  place(16.5, 31, 1.1, 2.4),
  place(-23, -4, 1.0, 0.9),
];

/** A ring of soft far hills, only seen in the low close-up shots. */
export const HILL_RING = { radius: 62, count: 14, seed: 91 } as const;

/** A small, fast, seeded random generator (mulberry32): the same seed always gives the same garden. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether (x, z) lies inside `e` grown by `margin` on both radii. */
export function insideEllipse(e: GroundEllipse, x: number, z: number, margin = 0): boolean {
  const dx = (x - e.x) / (e.rx + margin);
  const dz = (z - e.z) / (e.rz + margin);
  return dx * dx + dz * dz <= 1;
}

/** A smooth curve through the control points (Catmull-Rom), `perSegment` samples per span, ends included. */
export function sampleCurve(control: readonly Point[], perSegment: number): Point[] {
  if (control.length < 2) return [...control];
  const at = (i: number): Point => control[Math.max(0, Math.min(control.length - 1, i))] ?? [0, 0];
  const out: Point[] = [];
  for (let i = 0; i < control.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const axis = (k: 0 | 1): number =>
        0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([axis(0), axis(1)]);
    }
  }
  out.push(at(control.length - 1));
  return out;
}

/** Shortest distance from (x, z) to a polyline. */
export function distanceToPolyline(points: readonly Point[], x: number, z: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const abx = b[0] - a[0];
    const abz = b[1] - a[1];
    const lengthSq = abx * abx + abz * abz;
    const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / lengthSq)) : 0;
    best = Math.min(best, Math.hypot(x - (a[0] + abx * t), z - (a[1] + abz * t)));
  }
  return best;
}

/** The polyline moved sideways by `offset` (positive = left of the direction of travel). */
export function offsetPolyline(points: readonly Point[], offset: number): Point[] {
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)] ?? p;
    const next = points[Math.min(points.length - 1, i + 1)] ?? p;
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const length = Math.hypot(dx, dz) || 1;
    return [p[0] - (dz / length) * offset, p[1] + (dx / length) * offset];
  });
}

/** The stream's centre line, sampled finely enough for a smooth ribbon. */
export const STREAM_PATH: readonly Point[] = sampleCurve(STREAM_CONTROL, 10);

/** Whether (x, z) is on a pond or the stream, or within `margin` of one. */
export function onWater(x: number, z: number, margin = 0): boolean {
  if (PONDS.some((pond) => insideEllipse(pond, x, z, margin))) return true;
  return distanceToPolyline(STREAM_PATH, x, z) <= STREAM_HALF_WIDTH + margin;
}

export interface ScatterOptions {
  readonly count: number;
  readonly seed: number;
  /** Points land outside this ellipse... */
  readonly inner: GroundEllipse;
  /** ...and within this distance of the centre. */
  readonly outerRadius: number;
  /** No two points closer than this. */
  readonly minSpacing: number;
  /** Extra places to keep clear (water, trees); return true to reject a point. */
  readonly avoid?: (x: number, z: number) => boolean;
  readonly scale: readonly [number, number];
}

/**
 * Seeded rejection sampling: up to `count` points, spread evenly over the ring's area. Gives up on a point after a
 * bounded number of tries, so a crowded ring returns fewer points instead of looping forever.
 */
export function scatter(options: ScatterOptions): Placement[] {
  const random = seededRandom(options.seed);
  const out: Placement[] = [];
  const maxTries = options.count * 40;
  for (let tries = 0; tries < maxTries && out.length < options.count; tries += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * options.outerRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scale = options.scale[0] + random() * (options.scale[1] - options.scale[0]);
    const yaw = random() * Math.PI * 2;
    if (insideEllipse(options.inner, x, z)) continue;
    if (options.avoid?.(x, z)) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < options.minSpacing)) continue;
    out.push({ x, z, scale, yaw });
  }
  return out;
}

/**
 * Little drifts of flowers: seeded cluster centres scattered like `scatter`, each with `perCluster` flowers spread
 * within `spread`; flowers that land somewhere `avoid` rejects are dropped.
 */
export function scatterClusters(options: ScatterOptions, perCluster: number, spread: number): Placement[] {
  const random = seededRandom(options.seed * 7 + 3);
  return scatter(options).flatMap((centre) => {
    const out: Placement[] = [];
    for (let i = 0; i < perCluster; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * spread;
      const x = centre.x + Math.cos(angle) * radius;
      const z = centre.z + Math.sin(angle) * radius;
      if (insideEllipse(options.inner, x, z) || options.avoid?.(x, z)) continue;
      out.push({ x, z, scale: centre.scale * (0.8 + random() * 0.4), yaw: random() * Math.PI * 2 });
    }
    return out;
  });
}

/** Points around an ellipse's rim (pebbles round a pond), jittered in and out a little. */
export function rimPoints(e: GroundEllipse, count: number, seed: number, grow: number, scale: readonly [number, number]): Placement[] {
  const random = seededRandom(seed);
  const out: Placement[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = ((i + random() * 0.6) / count) * Math.PI * 2;
    const reach = 1 + (random() - 0.5) * 0.06;
    out.push({
      x: e.x + Math.cos(angle) * (e.rx + grow) * reach,
      z: e.z + Math.sin(angle) * (e.rz + grow) * reach,
      scale: scale[0] + random() * (scale[1] - scale[0]),
      yaw: random() * Math.PI * 2,
    });
  }
  return out;
}

/** Points inside an ellipse (lily pads on a pond), kept apart. */
export function pointsInside(e: GroundEllipse, count: number, seed: number, minSpacing: number, scale: readonly [number, number]): Placement[] {
  const random = seededRandom(seed);
  const out: Placement[] = [];
  for (let tries = 0; tries < count * 40 && out.length < count; tries += 1) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.82;
    const x = e.x + Math.cos(angle) * radius * e.rx;
    const z = e.z + Math.sin(angle) * radius * e.rz;
    const s = scale[0] + random() * (scale[1] - scale[0]);
    const yaw = random() * Math.PI * 2;
    if (out.some((p) => Math.hypot(p.x - x, p.z - z) < minSpacing)) continue;
    out.push({ x, z, scale: s, yaw });
  }
  return out;
}

/**
 * Soft, slow light-and-shade over the lawn, 0–1: a few long sine waves at odd angles, so the grass never shows a
 * regular pattern. Deterministic and cheap; baked into the lawn's vertex colours once.
 */
export function lawnVariation(x: number, z: number): number {
  const v =
    Math.sin(x * 0.11 + z * 0.07) * 0.35 +
    Math.sin(x * -0.05 + z * 0.13 + 1.7) * 0.3 +
    Math.sin(x * 0.23 - z * 0.19 + 4.1) * 0.2 +
    Math.sin(x * 0.37 + z * 0.31 + 2.3) * 0.15;
  return Math.max(0, Math.min(1, 0.5 + v * 0.5));
}
