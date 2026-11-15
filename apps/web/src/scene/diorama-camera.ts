/**
 * The fixed diorama camera: framed by `fitDioramaCamera` for the window's shape every frame (so rotating a phone or
 * resizing a window just works), turned by the small sway offsets, and breathing with a very slow idle drift.
 */
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { CameraOffset } from '../input/camera-sway-input';
import { CAMERA_TARGET, DIORAMA_EXTENT } from './diorama-layout';
import { fitDioramaCamera, orbitPosition } from './fit-diorama-camera';

export interface DioramaCamera {
  readonly camera: TargetCamera;
  /** Re-frames for the current aspect ratio and offset; returns the distance to the target (for focus). */
  update(aspect: number, offset: CameraOffset, timeMs: number): number;
}

/** Slight turn left and right while idle, a full cycle every 14 s. */
const IDLE_YAW = 0.018;
const IDLE_PERIOD_MS = 14000;

export function createDioramaCamera(scene: Scene, reducedMotion: boolean): DioramaCamera {
  const camera = new TargetCamera('diorama-camera', new Vector3(0, 10, -20), scene);
  camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
  camera.minZ = 0.5;
  camera.maxZ = 220;
  const target = new Vector3(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);

  return {
    camera,
    update(aspect, offset, timeMs) {
      const frame = fitDioramaCamera(aspect, DIORAMA_EXTENT);
      const idle = reducedMotion ? 0 : Math.sin((timeMs / IDLE_PERIOD_MS) * Math.PI * 2) * IDLE_YAW;
      const position = orbitPosition(CAMERA_TARGET, offset.yaw + idle, frame.pitch + offset.pitch, frame.distance);
      camera.fov = frame.fov;
      camera.position.set(position.x, position.y, position.z);
      camera.setTarget(target);
      return frame.distance;
    },
  };
}
