/**
 * The fixed diorama camera: framed by `fitDioramaCamera` for the window's shape every frame (so rotating a phone or
 * resizing a window just works), turned by the small sway offsets, and breathing with a very slow idle drift.
 * A play mode can ask for a closer shot (camera-shots.ts); the camera glides there and back.
 */
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { CameraOffset } from '../input/camera-sway-input';
import { CAMERA_SHOTS, type CameraShot, type CameraShotId, blendCameraShot, shotTargetFor } from './camera-shots';
import { DIORAMA_EXTENT } from './diorama-layout';
import { fitDioramaCamera, orbitPosition } from './fit-diorama-camera';

export interface DioramaCamera {
  readonly camera: TargetCamera;
  /** Re-frames for the current aspect ratio and offset; returns the distance to the target (for focus). */
  update(aspect: number, offset: CameraOffset, timeMs: number): number;
  /** Glides to a preferred framing (at once with reduced motion). */
  setShot(id: CameraShotId): void;
}

/** Slight turn left and right while idle, a full cycle every 14 s. */
const IDLE_YAW = 0.018;
const IDLE_PERIOD_MS = 14000;
/** Time constant of the glide between shots. */
const SHOT_GLIDE_MS = 420;

export function createDioramaCamera(scene: Scene, reducedMotion: boolean): DioramaCamera {
  const camera = new TargetCamera('diorama-camera', new Vector3(0, 10, -20), scene);
  camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
  camera.minZ = 0.3;
  camera.maxZ = 220;
  const target = new Vector3();
  let shot: CameraShot = CAMERA_SHOTS.yard;
  let wanted: CameraShot = shot;
  let lastTimeMs: number | null = null;

  return {
    camera,
    update(aspect, offset, timeMs) {
      const deltaMs = lastTimeMs === null ? 0 : Math.max(0, timeMs - lastTimeMs);
      lastTimeMs = timeMs;
      const goal = { ...wanted, target: shotTargetFor(wanted, aspect) };
      shot = reducedMotion ? goal : blendCameraShot(shot, goal, 1 - Math.exp(-deltaMs / SHOT_GLIDE_MS));
      const frame = fitDioramaCamera(aspect, DIORAMA_EXTENT);
      const idle = reducedMotion ? 0 : Math.sin((timeMs / IDLE_PERIOD_MS) * Math.PI * 2) * IDLE_YAW;
      const distance = frame.distance * shot.distanceScale;
      const position = orbitPosition(shot.target, offset.yaw + idle, frame.pitch + shot.pitchOffset + offset.pitch, distance);
      camera.fov = frame.fov;
      camera.position.set(position.x, position.y, position.z);
      target.set(shot.target.x, shot.target.y, shot.target.z);
      camera.setTarget(target);
      return distance;
    },
    setShot(id) {
      wanted = CAMERA_SHOTS[id];
    },
  };
}
