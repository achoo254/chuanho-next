/**
 * The render quality ladder, cheapest first. The automatic scaler moves one rung at a time; every rung is plain data
 * so the engine side only has to apply it.
 */

export interface QualityLevel {
  readonly id: 'low' | 'medium' | 'high' | 'ultra';
  /** Device pixels per CSS pixel the canvas may use (capped by the screen's own ratio). */
  readonly maxPixelRatio: number;
  /** Shadow map edge in texels; 0 turns shadows off. */
  readonly shadowMapSize: number;
  /** Percentage-closer filtering quality for the soft shadow edge. */
  readonly shadowFilter: 'low' | 'medium' | 'high';
  readonly bloom: boolean;
  /** The tilt-shift blur (depth of field): the most expensive effect. */
  readonly depthOfField: boolean;
  /** Multisample anti-aliasing samples on the post-process chain (1 = off, FXAA covers the edges then). */
  readonly msaaSamples: number;
  readonly fxaa: boolean;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = [
  { id: 'low', maxPixelRatio: 1, shadowMapSize: 0, shadowFilter: 'low', bloom: false, depthOfField: false, msaaSamples: 1, fxaa: true },
  { id: 'medium', maxPixelRatio: 1.25, shadowMapSize: 1024, shadowFilter: 'low', bloom: true, depthOfField: false, msaaSamples: 1, fxaa: true },
  { id: 'high', maxPixelRatio: 1.75, shadowMapSize: 1024, shadowFilter: 'medium', bloom: true, depthOfField: true, msaaSamples: 1, fxaa: true },
  { id: 'ultra', maxPixelRatio: 2, shadowMapSize: 2048, shadowFilter: 'high', bloom: true, depthOfField: true, msaaSamples: 4, fxaa: false },
];

export const TOP_QUALITY_LEVEL = QUALITY_LEVELS.length - 1;

/** The rung a device starts on: phones (coarse pointer) start one lower than computers and climb if they keep up. */
export function startingQualityLevel(coarsePointer: boolean): number {
  return coarsePointer ? 1 : 2;
}

/** The rung with this id, or null for an unknown id. */
export function qualityIndexOf(id: string | null): number | null {
  const index = QUALITY_LEVELS.findIndex((level) => level.id === id);
  return index >= 0 ? index : null;
}

export function qualityLevelAt(index: number): QualityLevel {
  const clamped = Math.max(0, Math.min(TOP_QUALITY_LEVEL, Math.round(index)));
  const level = QUALITY_LEVELS[clamped];
  if (!level) throw new Error(`No quality level at ${index}`);
  return level;
}
