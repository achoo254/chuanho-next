/**
 * The mascot striking the wooden bell by swapping frames of one image (no separate arm sprite): wind-up, swing,
 * hit (eyes closed, the strike sounds, the phone buzzes, the whole picture squashes a little), swing back, idle.
 * About 0.27 s in total. A new tap restarts the sequence at once (old timers cancelled), never queues behind it.
 *
 * Frames swap by writing `img.src` directly, so a tap costs no React render.
 */
import { type RefObject, useCallback, useEffect, useRef } from 'react';

const FRAME_BASE = '/art/tap-f-';
export const TAP_FRAMES = {
  idle: `${FRAME_BASE}idle.webp`,
  wind: `${FRAME_BASE}wind.webp`,
  mid: `${FRAME_BASE}mid.webp`,
  hit: `${FRAME_BASE}hit.webp`,
} as const;
type FrameName = keyof typeof TAP_FRAMES;

/** [frame, how long it holds in ms]. The hit frame is where the strike lands. */
const STRIKE_SEQUENCE: readonly (readonly [FrameName, number])[] = [
  ['wind', 45],
  ['mid', 45],
  ['hit', 120],
  ['mid', 60],
  ['idle', 0],
];

const preloaded: HTMLImageElement[] = [];
/** Loads and decodes every frame once, so the first strike does not flash an empty image. */
export function preloadTapFrames(): void {
  if (preloaded.length > 0) return;
  for (const src of Object.values(TAP_FRAMES)) {
    const image = new Image();
    image.src = src;
    image.decode().catch((error: unknown) => console.warn(`Tap frame ${src} failed to decode`, error));
    preloaded.push(image);
  }
}

export interface TapAnimation {
  readonly imgRef: RefObject<HTMLImageElement | null>;
  readonly stageRef: RefObject<HTMLDivElement | null>;
  /** Starts (or restarts) the strike; `onHit` runs when the stick lands. */
  strike(): void;
}

/** Restarts a CSS animation class on `element` (remove, force a reflow, add back). */
export function replayClass(element: HTMLElement | null, className: string): void {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

export function useTapAnimation(onHit: () => void): TapAnimation {
  const imgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const onHitRef = useRef(onHit);
  useEffect(() => {
    onHitRef.current = onHit;
  }, [onHit]);

  useEffect(() => {
    preloadTapFrames();
    const pending = timers;
    return () => pending.current.forEach((id) => window.clearTimeout(id));
  }, []);

  const strike = useCallback((): void => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    let at = 0;
    for (const [frame, hold] of STRIKE_SEQUENCE) {
      const show = (): void => {
        const img = imgRef.current;
        if (img) img.src = TAP_FRAMES[frame];
        if (frame === 'hit') {
          replayClass(stageRef.current, 'is-thump');
          onHitRef.current();
        }
      };
      // The first frame shows in this very event, not a timer tick later.
      if (at === 0) show();
      else timers.current.push(window.setTimeout(show, at));
      at += hold;
    }
  }, []);

  return { imgRef, stageRef, strike };
}
