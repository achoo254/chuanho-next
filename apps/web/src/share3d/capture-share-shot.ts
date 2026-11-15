/**
 * The share picture taken from the 3D scene itself: the main camera (so tone mapping, bloom and the miniature blur
 * all apply) moved to a portrait close-up of the character at the wooden fish, rendered once into a 1080 × 1920
 * target and read back as a PNG data URL. The caller pauses its own camera updates while this runs.
 */
import type { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools';
import { CHARACTER_SPOT, MO_STAND_SPOT } from '../scene/diorama-layout';
import { orbitPosition } from '../scene/fit-diorama-camera';

export const SHARE_SHOT_WIDTH = 1080;
export const SHARE_SHOT_HEIGHT = 1920;

/**
 * Framing of the share shot: the character and the wooden fish fill the middle band of the card, with room above
 * for the title and below for the stat panels (the camera aims a little under them, so they sit higher).
 */
export const SHARE_SHOT = {
  target: {
    x: (CHARACTER_SPOT.position[0] + MO_STAND_SPOT.position[0]) / 2,
    y: 0.55,
    z: (CHARACTER_SPOT.position[2] + MO_STAND_SPOT.position[2]) / 2,
  },
  yaw: -0.18,
  pitch: 0.36,
  distance: 6.4,
  fov: 0.62,
} as const;

/** Points the camera at the share framing; returns the focus distance for the depth of field. */
export function aimShareCamera(camera: TargetCamera): number {
  const { target, yaw, pitch, distance, fov } = SHARE_SHOT;
  const position = orbitPosition(target, yaw, pitch, distance);
  camera.position.set(position.x, position.y, position.z);
  camera.fov = fov;
  camera.setTarget(new Vector3(target.x, target.y, target.z));
  return distance;
}

export async function renderShareShot(engine: AbstractEngine, camera: TargetCamera): Promise<string> {
  const data = await CreateScreenshotUsingRenderTargetAsync(engine, camera, { width: SHARE_SHOT_WIDTH, height: SHARE_SHOT_HEIGHT }, 'image/png', 4, true);
  if (typeof data !== 'string' || !data.startsWith('data:image')) throw new Error('The scene could not be captured');
  return data;
}
