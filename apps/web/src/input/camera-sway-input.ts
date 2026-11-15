/**
 * The player's hands on the camera. Two layers:
 * - a small, eased sway from the mouse position (computers) or the phone's tilt, which only adds life;
 * - a free view: dragging empty ground orbits around the yard (any angle, tilt limited so the camera stays above the
 *   ground), the wheel or a two-finger pinch zooms in and out, and the view stays where the player leaves it until
 *   `resetView()` (double click, the R key, or entering a play mode, whose own shots need the default framing).
 * With reduced motion the sway does nothing and the free view jumps instead of easing.
 */

export interface CameraOffset {
  readonly yaw: number;
  readonly pitch: number;
  /** Multiplies the camera's distance: below 1 is closer. */
  readonly zoom: number;
}

export interface CameraSwayInput {
  /** The smoothed offset for this frame. */
  update(deltaMs: number): CameraOffset;
  beginDrag(clientX: number, clientY: number): void;
  dragTo(clientX: number, clientY: number): void;
  endDrag(): void;
  /** Zooms by a factor (below 1 closer, above 1 farther), clamped to the allowed range. */
  zoomBy(factor: number): void;
  /** Back to the framed default view. */
  resetView(): void;
  readonly dragging: boolean;
  /** True once the player has turned or zoomed the view away from the default. */
  readonly viewChanged: boolean;
  dispose(): void;
}

const LOOK_YAW = 0.06;
const LOOK_PITCH = 0.04;
/** Radians of turn per CSS pixel dragged. */
const DRAG_SENSITIVITY = 0.0055;
/** Tilt range of the free view around the framed angle: down onto the yard, or low and level. */
export const FREE_PITCH_MIN = -0.5;
export const FREE_PITCH_MAX = 0.55;
/** Closest and farthest zoom, as a share of the framed distance. */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 1.9;
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const clampSym = (value: number, limit: number): number => clamp(value, -limit, limit);

export function createCameraSwayInput(reducedMotion: boolean): CameraSwayInput {
  let lookX = 0;
  let lookY = 0;
  let freeYaw = 0;
  let freePitch = 0;
  let zoom = 1;
  let dragLastX = 0;
  let dragLastY = 0;
  let dragging = false;
  let current: CameraOffset = { yaw: 0, pitch: 0, zoom: 1 };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || window.innerWidth === 0 || window.innerHeight === 0) return;
    lookX = clampSym(event.clientX / window.innerWidth - 0.5, 0.5);
    lookY = clampSym(event.clientY / window.innerHeight - 0.5, 0.5);
  };
  const onOrientation = (event: DeviceOrientationEvent): void => {
    if (event.gamma === null || event.beta === null) return;
    // Holding the phone at about 45° is "level".
    lookX = clampSym(event.gamma / 40, 0.5);
    lookY = clampSym((event.beta - 45) / 60, 0.5);
  };
  if (!reducedMotion) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  return {
    get dragging() {
      return dragging;
    },
    get viewChanged() {
      return Math.abs(freeYaw) > 0.01 || Math.abs(freePitch) > 0.01 || Math.abs(zoom - 1) > 0.01;
    },
    update(deltaMs) {
      const target: CameraOffset = { yaw: lookX * LOOK_YAW * 2 + freeYaw, pitch: -lookY * LOOK_PITCH * 2 + freePitch, zoom };
      if (reducedMotion) {
        current = target;
        return current;
      }
      const follow = 1 - Math.exp(-deltaMs / 120);
      current = {
        yaw: current.yaw + (target.yaw - current.yaw) * follow,
        pitch: current.pitch + (target.pitch - current.pitch) * follow,
        zoom: current.zoom + (target.zoom - current.zoom) * follow,
      };
      return current;
    },
    beginDrag(clientX, clientY) {
      dragging = true;
      dragLastX = clientX;
      dragLastY = clientY;
    },
    dragTo(clientX, clientY) {
      if (!dragging) return;
      freeYaw += (clientX - dragLastX) * DRAG_SENSITIVITY;
      // Wrap so a long spin never grows without bound.
      if (freeYaw > Math.PI) freeYaw -= Math.PI * 2;
      if (freeYaw < -Math.PI) freeYaw += Math.PI * 2;
      freePitch = clamp(freePitch + (clientY - dragLastY) * DRAG_SENSITIVITY, FREE_PITCH_MIN, FREE_PITCH_MAX);
      dragLastX = clientX;
      dragLastY = clientY;
    },
    endDrag() {
      dragging = false;
    },
    zoomBy(factor) {
      if (factor > 0 && Number.isFinite(factor)) zoom = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
    },
    resetView() {
      freeYaw = 0;
      freePitch = 0;
      zoom = 1;
    },
    dispose() {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('deviceorientation', onOrientation);
    },
  };
}
