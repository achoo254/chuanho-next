/**
 * The automatic quality scaler at run time: feeds every frame's duration to the pure decision and, on a change,
 * applies the new rung (canvas resolution, shadows, post-processing) through `apply`.
 */
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { type QualityLevel, TOP_QUALITY_LEVEL, qualityLevelAt } from './quality-levels';
import { type ScalerState, initialScalerState, stepQualityScaler } from './quality-scaler-decision';

export interface QualityScaler {
  readonly level: QualityLevel;
  onFrame(frameMs: number): void;
  /** Re-applies the canvas resolution (after the window moves to a screen with another pixel ratio). */
  refreshPixelRatio(): void;
}

/** Canvas pixels per CSS pixel for a rung, never above what the screen has. */
function pixelRatioFor(level: QualityLevel): number {
  return Math.min(window.devicePixelRatio || 1, level.maxPixelRatio);
}

/** With `pinned`, the start rung stays for the whole visit and frame times are ignored. */
export function createQualityScaler(engine: AbstractEngine, startLevel: number, pinned: boolean, apply: (level: QualityLevel) => void): QualityScaler {
  let state: ScalerState = initialScalerState(startLevel, TOP_QUALITY_LEVEL);
  let level = qualityLevelAt(state.level);

  const applyLevel = (): void => {
    engine.setHardwareScalingLevel(1 / pixelRatioFor(level));
    apply(level);
  };
  applyLevel();

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
      applyLevel();
    },
    refreshPixelRatio() {
      engine.setHardwareScalingLevel(1 / pixelRatioFor(level));
    },
  };
}
