/**
 * The automatic quality scaler at run time: feeds every frame's duration to the pure decision and, on a change, hands
 * the new rung to `apply` (shadows, post-processing, canvas resolution).
 *
 * The scaler never resizes the canvas itself. Resizing a canvas wipes the picture already drawn on it, so the render
 * loop applies `pixelRatioFor(level)` right before it draws the next frame (boot-babylon-world.ts).
 */
import { type QualityLevel, TOP_QUALITY_LEVEL, qualityLevelAt } from './quality-levels';
import { type ScalerState, initialScalerState, stepQualityScaler } from './quality-scaler-decision';

export interface QualityScaler {
  readonly level: QualityLevel;
  onFrame(frameMs: number): void;
}

/** Canvas pixels per CSS pixel for a rung, never above what the screen has. */
export function pixelRatioFor(level: QualityLevel): number {
  return Math.min(window.devicePixelRatio || 1, level.maxPixelRatio);
}

/** With `pinned`, the start rung stays for the whole visit and frame times are ignored. `apply` also runs once now. */
export function createQualityScaler(startLevel: number, pinned: boolean, apply: (level: QualityLevel) => void): QualityScaler {
  let state: ScalerState = initialScalerState(startLevel, TOP_QUALITY_LEVEL);
  let level = qualityLevelAt(state.level);
  apply(level);

  return {
    get level() {
      return level;
    },
    onFrame(frameMs) {
      if (pinned) return;
      const step = stepQualityScaler(state, frameMs);
      state = step.state;
      if (step.change === 0) return;
      level = qualityLevelAt(state.level);
      apply(level);
    },
  };
}
