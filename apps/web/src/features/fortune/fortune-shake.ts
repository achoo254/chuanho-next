/**
 * Shaking the phone to shake the tube: optional sugar on top of the button and Space. Listens to `devicemotion`
 * (where the browser gives it; iOS asks for permission at the Start tap) and calls back once per shake, with a rest
 * time so one shake is not counted as several.
 */
import { useEffect, useRef } from 'react';

/** Acceleration (m/s², gravity excluded) a shake must reach; a walk or a tap on the screen stays well below. */
export const SHAKE_THRESHOLD = 15;
export const SHAKE_REST_MS = 1200;

/** Whether one motion sample is a shake (pure, for tests). Missing axes count as still. */
export function isShakeMotion(x: number | null, y: number | null, z: number | null, threshold = SHAKE_THRESHOLD): boolean {
  const magnitude = Math.hypot(x ?? 0, y ?? 0, z ?? 0);
  return Number.isFinite(magnitude) && magnitude >= threshold;
}

/** Calls `onShake` when the device is shaken while `enabled`; does nothing where there is no motion sensor. */
export function useShakeGesture(enabled: boolean, onShake: () => void): void {
  const latest = useRef(onShake);
  useEffect(() => {
    latest.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    let restUntil = 0;
    const listener = (event: DeviceMotionEvent): void => {
      const a = event.acceleration;
      if (!a || !isShakeMotion(a.x, a.y, a.z) || event.timeStamp < restUntil) return;
      restUntil = event.timeStamp + SHAKE_REST_MS;
      latest.current();
    };
    window.addEventListener('devicemotion', listener);
    return () => window.removeEventListener('devicemotion', listener);
  }, [enabled]);
}
