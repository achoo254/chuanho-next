/**
 * Depth for the layered scenes: the phone's tilt (or the mouse on a computer) becomes two CSS custom properties,
 * `--tilt-x` and `--tilt-y` in -0.5..0.5, on the scene element. Each layer multiplies them by its own depth in CSS,
 * so one style write per frame moves every layer. With reduced motion the values stay at 0.
 */
import { type RefObject, useEffect } from 'react';

type OrientationPermission = 'granted' | 'denied' | 'default';
type OrientationEventWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<OrientationPermission> };

/**
 * Asks iOS for motion access. Must run inside a tap (the Start button); elsewhere it is not needed and resolves at
 * once. A refusal only means the scene follows nothing on that phone.
 */
export async function requestTiltPermission(): Promise<void> {
  if (typeof DeviceOrientationEvent === 'undefined') return;
  const request = (DeviceOrientationEvent as OrientationEventWithPermission).requestPermission;
  if (typeof request !== 'function') return;
  try {
    await request.call(DeviceOrientationEvent);
  } catch (error) {
    console.warn('Motion access not granted; the scene stays still', error);
  }
}

const clamp = (value: number): number => Math.max(-0.5, Math.min(0.5, value));

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useParallaxTilt(sceneRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || prefersReducedMotion()) return;
    let frame = 0;
    let target = { x: 0, y: 0 };

    const write = (): void => {
      frame = 0;
      scene.style.setProperty('--tilt-x', target.x.toFixed(3));
      scene.style.setProperty('--tilt-y', target.y.toFixed(3));
    };
    const set = (x: number, y: number): void => {
      target = { x: clamp(x), y: clamp(y) };
      if (!frame) frame = requestAnimationFrame(write);
    };

    const onPointer = (event: PointerEvent): void => {
      if (event.pointerType !== 'mouse') return; // touch drives taps, not the camera
      const rect = scene.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      set((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5);
    };
    const onOrientation = (event: DeviceOrientationEvent): void => {
      if (event.gamma === null || event.beta === null) return;
      // Holding the phone at about 45° is "level".
      set(event.gamma / 40, (event.beta - 45) / 60);
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onOrientation);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sceneRef]);
}
