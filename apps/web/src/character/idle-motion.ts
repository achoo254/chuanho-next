/**
 * Small life between scenes, all as pure functions of time: breathing, blinks at uneven moments, and a little
 * bounce on each beat of the music.
 */

/** One breath, in and out (the default; meditation breathes slower). */
export const BREATH_PERIOD_MS = 3400;
/** Blinks come once per window, at a different moment in each. */
export const BLINK_WINDOW_MS = 3800;
export const BLINK_MS = 130;

/** Vertical scale offset of the body for breathing (0 with reduced motion). */
export function breathAt(timeMs: number, reducedMotion: boolean, depth = 0.018, periodMs = BREATH_PERIOD_MS): number {
  if (reducedMotion || !Number.isFinite(timeMs) || periodMs <= 0) return 0;
  return Math.sin((timeMs / periodMs) * Math.PI * 2) * depth;
}

/** A stable pseudo-random number in [0, 1) for a window index, so blinks look uneven but replay the same. */
function windowJitter(index: number): number {
  const x = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** True while the eyes are shut for a blink. One blink per window, never at the very edge of it. */
export function isBlinkingAt(timeMs: number): boolean {
  if (!Number.isFinite(timeMs) || timeMs < 0) return false;
  const index = Math.floor(timeMs / BLINK_WINDOW_MS);
  const start = index * BLINK_WINDOW_MS + 300 + windowJitter(index) * (BLINK_WINDOW_MS - 600 - BLINK_MS);
  return timeMs >= start && timeMs < start + BLINK_MS;
}

/** 0..1 bounce on each beat: up right at the beat, settling before the next. 0 before the song starts. */
export function beatBounceAt(songMs: number | null, beatMs: number): number {
  if (songMs === null || !Number.isFinite(songMs) || songMs < 0 || beatMs <= 0) return 0;
  const phase = (songMs % beatMs) / beatMs;
  return Math.exp(-phase * 5) * (1 - phase);
}
