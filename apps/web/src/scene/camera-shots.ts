/**
 * Preferred camera framings per play mode, relative to the fitted diorama view: where to look, how much closer and
 * how much lower. The camera glides between them; the yard view is the identity (the whole diorama, as framed by
 * `fitDioramaCamera`). Pure data and blending.
 */
import { CAMERA_TARGET, CHARACTER_SPOT, MO_STAND_SPOT } from './diorama-layout';
import type { Vec3 } from './fit-diorama-camera';

export interface CameraShot {
  readonly target: Vec3;
  /** Share of the fitted distance (1 = the whole yard). */
  readonly distanceScale: number;
  /** Added to the fitted elevation, radians (negative = lower, looking more from the side). */
  readonly pitchOffset: number;
  /** Where to look on a tall (portrait) screen, when that differs (HTML panels sit above the scene there). */
  readonly portraitTarget?: Vec3;
}

export const CAMERA_SHOT_IDS = ['yard', 'drum', 'incense', 'sutra'] as const;
export type CameraShotId = (typeof CAMERA_SHOT_IDS)[number];

/** Between the character and the wooden fish, at chest height. */
const DRUM_POINT: Vec3 = {
  x: (CHARACTER_SPOT.position[0] + MO_STAND_SPOT.position[0]) / 2,
  y: 0.85,
  z: (CHARACTER_SPOT.position[2] + MO_STAND_SPOT.position[2]) / 2,
};

export const CAMERA_SHOTS: Readonly<Record<CameraShotId, CameraShot>> = {
  yard: { target: CAMERA_TARGET, distanceScale: 1, pitchOffset: 0 },
  drum: { target: DRUM_POINT, distanceScale: 0.24, pitchOffset: -0.16 },
  incense: { target: { x: 0, y: 1.3, z: 0.5 }, distanceScale: 0.26, pitchOffset: -0.12 },
  // Lower and towards the sutra stand, with the character still in the frame.
  // On computers the paper floats on the left, so the view leans left; on phones it sits on top, so the view centres.
  sutra: { target: { x: -2.1, y: 0.8, z: -1.7 }, portraitTarget: { x: -1.3, y: 0.55, z: -2.1 }, distanceScale: 0.36, pitchOffset: -0.22 },
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** A shot's target for the screen's shape (portrait below this aspect). */
export function shotTargetFor(shot: CameraShot, aspect: number): Vec3 {
  return aspect < 0.8 && shot.portraitTarget ? shot.portraitTarget : shot.target;
}

/** The in-between framing (its target already resolved for the screen; see `shotTargetFor`). */
export function blendCameraShot(from: CameraShot, to: CameraShot, t: number): CameraShot {
  const s = Math.max(0, Math.min(1, t));
  return {
    target: { x: lerp(from.target.x, to.target.x, s), y: lerp(from.target.y, to.target.y, s), z: lerp(from.target.z, to.target.z, s) },
    distanceScale: lerp(from.distanceScale, to.distanceScale, s),
    pitchOffset: lerp(from.pitchOffset, to.pitchOffset, s),
  };
}
