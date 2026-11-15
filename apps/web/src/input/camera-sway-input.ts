/**
 * Small camera offsets from the player: the mouse position (computers) or the phone's tilt nudge the view a little,
 * and a drag or swipe on empty ground turns it a bit further, easing back when released. Every offset is clamped,
 * so the diorama never turns into a free orbit. With reduced motion, pointer and tilt do nothing; a drag still turns
 * the view (the player asked for it) but stays where it is left instead of drifting back.
 */

export interface CameraOffset {
  readonly yaw: number;
  readonly pitch: number;
}

export interface CameraSwayInput {
  /** The smoothed offset for this frame. */
  update(deltaMs: number): CameraOffset;
  beginDrag(clientX: number): void;
  dragTo(clientX: number): void;
  endDrag(): void;
  readonly dragging: boolean;
  dispose(): void;
}

const LOOK_YAW = 0.06;
const LOOK_PITCH = 0.04;
const DRAG_YAW_LIMIT = 0.32;
/** Radians of turn per CSS pixel dragged. */
const DRAG_SENSITIVITY = 0.0035;
const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value));

export function createCameraSwayInput(reducedMotion: boolean): CameraSwayInput {
  let lookX = 0;
  let lookY = 0;
  let dragYaw = 0;
  let dragStartX = 0;
  let dragStartYaw = 0;
  let dragging = false;
  let current: CameraOffset = { yaw: 0, pitch: 0 };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || window.innerWidth === 0 || window.innerHeight === 0) return;
    lookX = clamp(event.clientX / window.innerWidth - 0.5, 0.5);
    lookY = clamp(event.clientY / window.innerHeight - 0.5, 0.5);
  };
  const onOrientation = (event: DeviceOrientationEvent): void => {
    if (event.gamma === null || event.beta === null) return;
    // Holding the phone at about 45° is "level", as in the 2D scene.
    lookX = clamp(event.gamma / 40, 0.5);
    lookY = clamp((event.beta - 45) / 60, 0.5);
  };
  if (!reducedMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  return {
    get dragging() {
      return dragging;
    },
    update(deltaMs) {
      if (!dragging && !reducedMotion) dragYaw *= Math.exp(-deltaMs / 900); // ease back to the framed angle
      const target: CameraOffset = { yaw: lookX * LOOK_YAW * 2 + dragYaw, pitch: -lookY * LOOK_PITCH * 2 };
      if (reducedMotion) {
        current = target;
        return current;
      }
      const follow = 1 - Math.exp(-deltaMs / 160);
      current = { yaw: current.yaw + (target.yaw - current.yaw) * follow, pitch: current.pitch + (target.pitch - current.pitch) * follow };
      return current;
    },
    beginDrag(clientX) {
      dragging = true;
      dragStartX = clientX;
      dragStartYaw = dragYaw;
    },
    dragTo(clientX) {
      if (dragging) dragYaw = clamp(dragStartYaw + (clientX - dragStartX) * DRAG_SENSITIVITY, DRAG_YAW_LIMIT);
    },
    endDrag() {
      dragging = false;
    },
    dispose() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('deviceorientation', onOrientation);
    },
  };
}
