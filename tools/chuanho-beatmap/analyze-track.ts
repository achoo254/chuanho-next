/**
 * One track's beatmap from its decoded samples: onset envelope -> dominant pulse -> folded tempo (and its
 * three-against-two readings) -> best rigid beat grid -> confidence -> first downbeat -> the three levels. A track below the playable confidence keeps its tempo and
 * confidence in the file (useful when tuning) but gets no levels, so the game never offers it.
 *
 * Pure and deterministic: the same samples always give the same beatmap.
 */
import { measureConfidence, PLAYABLE_CONFIDENCE } from './beat-confidence';
import { generateLevels, type BeatmapLevels } from './beatmap-levels';
import { ANALYSIS_RATE, onsetEnvelope } from './onset-envelope';
import { chooseBeatGrid, coarseTempo, firstDownbeatMs } from './tempo-grid';

export const BEATMAP_VERSION = 1;
/** Fewer easy notes than this is not a song worth offering. */
const MIN_EASY_NOTES = 16;

export interface Beatmap {
  readonly version: typeof BEATMAP_VERSION;
  readonly trackId: string;
  /** Tempo of the grid (folded into the playable octave), two decimals. */
  readonly bpm: number;
  /** Time (ms from the start of the audio file) of the first downbeat; every beat is `offsetMs + n * 60000 / bpm`. */
  readonly offsetMs: number;
  /** 0..1, how far the grid can be trusted (see beat-confidence.ts). */
  readonly confidence: number;
  readonly playable: boolean;
  /** Note times in ms from the start of the audio file; present only when playable. */
  readonly levels?: BeatmapLevels;
}

export interface BeatmapIndexEntry {
  readonly trackId: string;
  readonly bpm: number;
  readonly durationMs: number;
  readonly playable: boolean;
}

export interface TrackAnalysis {
  readonly beatmap: Beatmap;
  readonly index: BeatmapIndexEntry;
  /** Confidence parts, for the CLI's report only (not written to the beatmap). */
  readonly detail: { readonly hitRate: number; readonly steadiness: number; readonly contrast: number; readonly rawBpm: number };
}

/** Analyses mono samples at ANALYSIS_RATE. */
export function analyzeTrack(trackId: string, samples: Float32Array): TrackAnalysis {
  const durationMs = Math.round((samples.length / ANALYSIS_RATE) * 1000);
  const envelope = onsetEnvelope(samples);
  const rawBpm = coarseTempo(envelope);
  const grid = chooseBeatGrid(envelope, rawBpm);
  const unplayable = (bpm: number): TrackAnalysis => ({
    beatmap: { version: BEATMAP_VERSION, trackId, bpm, offsetMs: 0, confidence: 0, playable: false },
    index: { trackId, bpm, durationMs, playable: false },
    detail: { hitRate: 0, steadiness: 0, contrast: 0, rawBpm: round2(rawBpm) },
  });
  if (!grid) return unplayable(0);

  const bpm = round2(grid.bpm);
  const quality = measureConfidence(envelope, grid);
  const offsetMs = Math.round(firstDownbeatMs(envelope, grid));
  const detail = { hitRate: quality.hitRate, steadiness: quality.steadiness, contrast: quality.contrast, rawBpm: round2(rawBpm) };
  let levels: BeatmapLevels | undefined;
  if (quality.confidence >= PLAYABLE_CONFIDENCE) {
    levels = generateLevels({ envelope, grid, downbeatMs: offsetMs, durationMs });
    // A track too short to carry a real song is not offered either.
    if (levels.easy.length < MIN_EASY_NOTES) levels = undefined;
  }
  const playable = levels !== undefined;
  return {
    beatmap: { version: BEATMAP_VERSION, trackId, bpm, offsetMs, confidence: quality.confidence, playable, ...(levels ? { levels } : {}) },
    index: { trackId, bpm, durationMs, playable },
    detail,
  };
}

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}
