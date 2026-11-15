/**
 * Frames the diorama for any window shape. Pure math, no engine: the camera code feeds it the window's aspect ratio
 * and the yard's size and gets back the view angle, the lens and the distance.
 *
 * - Landscape (computers): a lower, three-quarter look with a narrow lens, the "miniature on a desk" feel.
 * - Portrait (phones): a steeper look so the yard's depth fills the tall screen, and the decorative edges may crop a
 *   little so the props in the middle stay large enough to tap.
 * - Ultra-wide: the height decides the distance, so the yard never shrinks to a strip; the sky fills the sides.
 */

/** The yard's size around the camera target, in scene units. */
export interface DioramaExtent {
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly height: number;
}

export interface CameraFrame {
  /** Elevation above the horizon, in radians (0 = level, π/2 = straight down). */
  readonly pitch: number;
  /** Vertical field of view, in radians. */
  readonly fov: number;
  /** Distance from the target. */
  readonly distance: number;
}

const PORTRAIT_ASPECT = 0.5;
const LANDSCAPE_ASPECT = 1.6;
const PORTRAIT = { pitch: 0.92, fov: 0.92, widthCoverage: 0.64 } as const;
const LANDSCAPE = { pitch: 0.64, fov: 0.62, widthCoverage: 1 } as const;
/** Breathing room around the yard. */
const MARGIN = 1.06;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function fitDioramaCamera(aspect: number, extent: DioramaExtent): CameraFrame {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const t = clamp01((safeAspect - PORTRAIT_ASPECT) / (LANDSCAPE_ASPECT - PORTRAIT_ASPECT));
  const pitch = lerp(PORTRAIT.pitch, LANDSCAPE.pitch, t);
  const fov = lerp(PORTRAIT.fov, LANDSCAPE.fov, t);
  const widthCoverage = lerp(PORTRAIT.widthCoverage, LANDSCAPE.widthCoverage, t);

  const halfVertical = Math.tan(fov / 2);
  const halfHorizontal = halfVertical * safeAspect;
  // Seen from above at `pitch`, the yard's depth shortens by sin(pitch) and its height by cos(pitch).
  const projectedHalfHeight = extent.halfDepth * Math.sin(pitch) + (extent.height / 2) * Math.cos(pitch);
  const byWidth = (extent.halfWidth * widthCoverage) / halfHorizontal;
  const byHeight = projectedHalfHeight / halfVertical;
  return { pitch, fov, distance: Math.max(byWidth, byHeight) * MARGIN };
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Where the camera sits for a target, a turn around the vertical axis (`yaw`, 0 = looking along +z from the front),
 * an elevation and a distance.
 */
export function orbitPosition(target: Vec3, yaw: number, pitch: number, distance: number): Vec3 {
  const ground = Math.cos(pitch) * distance;
  return {
    x: target.x - Math.sin(yaw) * ground,
    y: target.y + Math.sin(pitch) * distance,
    z: target.z - Math.cos(yaw) * ground,
  };
}
