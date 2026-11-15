/**
 * How far a beat grid can be trusted for a rhythm game, from the onset envelope alone:
 * - hit rate: the share of beats that land on an onset clearly above the track's average strength, or of every
 *   second beat when that is higher (music whose pulse is half the folded grid tempo, or that leaves beats 2 and 4
 *   quiet, still has a pulse on every other beat, which is where the easy level and the downbeats go);
 * - steadiness: the share of eight-beat windows whose own best alignment stays within a few frames of the global
 *   grid (a drifting or rubato track loses it, so does one whose "beats" are noise lining up by chance);
 * - contrast: onset strength on the beats against the quarter points between them (a pulse, not a wash of sound;
 *   the half beats are left out because music that also plays them is still a clear pulse).
 * The confidence is hit rate times steadiness, zeroed when the contrast is too weak. Pure and deterministic.
 */
import type { OnsetEnvelope } from './onset-envelope';
import { type BeatGrid, envelopeAt, frameOf, smoothEnvelope } from './tempo-grid';

/** Beats scoring at least this many times the mean strength count as hits. */
const HIT_RATIO = 1.5;
const WINDOW_BEATS = 8;
/** Largest local misalignment (ms) of a window that still counts as steady. */
const STEADY_TOLERANCE_MS = 35;
/** On-beat strength must exceed the off-beat strength by this factor. */
const MIN_CONTRAST = 1.3;
/** Fewer beats than this in the active span: not enough music to judge (or to play). */
const MIN_BEATS = 32;
/** A track is playable in Mõ Beat at or above this confidence. */
export const PLAYABLE_CONFIDENCE = 0.5;

export interface BeatConfidence {
  readonly hitRate: number;
  readonly steadiness: number;
  readonly contrast: number;
  readonly confidence: number;
}

const NONE: BeatConfidence = { hitRate: 0, steadiness: 0, contrast: 0, confidence: 0 };

/** Largest smoothed strength within ±2 frames of a time. */
function peakNear(envelope: OnsetEnvelope, smooth: Float32Array, ms: number): number {
  const centre = frameOf(envelope, ms);
  let peak = 0;
  for (let d = -2; d <= 2; d += 0.5) peak = Math.max(peak, envelopeAt(smooth, centre + d));
  return peak;
}

export function measureConfidence(envelope: OnsetEnvelope, grid: BeatGrid): BeatConfidence {
  const smooth = smoothEnvelope(envelope.strength);
  const { activeStart, activeEnd, frameMs, timeOffsetMs } = envelope;
  const startMs = activeStart * frameMs + timeOffsetMs;
  const endMs = activeEnd * frameMs + timeOffsetMs;
  const beats: number[] = [];
  for (let t = grid.phaseMs + Math.ceil((startMs - grid.phaseMs) / grid.beatMs) * grid.beatMs; t < endMs; t += grid.beatMs) beats.push(t);
  if (beats.length < MIN_BEATS) return NONE;

  let mean = 0;
  for (let f = activeStart; f < activeEnd; f += 1) mean += smooth[f] ?? 0;
  mean /= Math.max(1, activeEnd - activeStart);
  if (!(mean > 0)) return NONE;

  const hitsByParity = [0, 0];
  let onBeat = 0;
  let offBeat = 0;
  beats.forEach((t, n) => {
    const peak = peakNear(envelope, smooth, t);
    if (peak >= HIT_RATIO * mean) hitsByParity[n % 2] = (hitsByParity[n % 2] ?? 0) + 1;
    onBeat += peak;
    offBeat += (peakNear(envelope, smooth, t + grid.beatMs / 4) + peakNear(envelope, smooth, t + (3 * grid.beatMs) / 4)) / 2;
  });
  const [evenHits = 0, oddHits = 0] = hitsByParity;
  const evenBeats = Math.ceil(beats.length / 2);
  const oddBeats = Math.floor(beats.length / 2);
  const hitRate = Math.max((evenHits + oddHits) / beats.length, evenHits / evenBeats, oddBeats > 0 ? oddHits / oddBeats : 0);
  const contrast = offBeat > 0 ? onBeat / offBeat : onBeat > 0 ? 99 : 0;

  // Each window's best local shift within ±40% of a beat, in frame steps.
  const maxShiftFrames = (0.4 * grid.beatMs) / frameMs;
  let windows = 0;
  let steady = 0;
  for (let w = 0; w + WINDOW_BEATS <= beats.length; w += WINDOW_BEATS) {
    const slice = beats.slice(w, w + WINDOW_BEATS);
    let bestShift = 0;
    let bestScore = -Infinity;
    for (let shift = -maxShiftFrames; shift <= maxShiftFrames; shift += 0.5) {
      let score = 0;
      for (const t of slice) score += envelopeAt(smooth, frameOf(envelope, t) + shift);
      // Prefer the smallest shift among equal scores (deterministic, and a flat window counts as aligned).
      if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && Math.abs(shift) < Math.abs(bestShift))) {
        bestScore = score;
        bestShift = shift;
      }
    }
    windows += 1;
    if (Math.abs(bestShift) * frameMs <= STEADY_TOLERANCE_MS) steady += 1;
  }
  const steadiness = windows > 0 ? steady / windows : 0;
  const confidence = contrast >= MIN_CONTRAST ? hitRate * steadiness : 0;
  return { hitRate: round3(hitRate), steadiness: round3(steadiness), contrast: round3(contrast), confidence: round3(confidence) };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
