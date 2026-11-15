/**
 * Onset strength of a mono signal: a log-compressed spectral flux (how much louder each frequency got since the
 * previous frame, summed), with its slow trend removed, so a plucked note, a bell or a soft kick all make a peak.
 * Also the track's active span (first and last loud frame), so fades and silence carry no notes.
 *
 * Pure and deterministic: the same samples always give the same envelope.
 */

/** Analysis rate: ffmpeg decodes every track to mono at this rate (enough for onsets, cheap to transform). */
export const ANALYSIS_RATE = 11025;
const FFT_SIZE = 512;
const HOP = 128;
/** Frames per second of the envelope (about 86, one frame every 11.6 ms). */
export const FRAME_RATE = ANALYSIS_RATE / HOP;
/** Moving-average window removed from the flux (about 0.4 s): keeps attacks, drops slow swells. */
const TREND_FRAMES = 35;
/** A frame is "active" when its level is within this many dB of the track's loud passages. */
const ACTIVE_RANGE_DB = 40;
/**
 * Measured on synthetic clicks: the beat grid lands about 10 ms before the attacks (the smoothed flux hill leans
 * towards the window's leading edge), so frame times are pushed later by that much. The click tests hold the
 * offset within 20 ms.
 */
const ONSET_SHIFT_MS = 10;

export interface OnsetEnvelope {
  /** Onset strength per frame, >= 0, scaled so its mean over the active span is about 1. */
  readonly strength: Float32Array;
  /** Time (ms) of frame i is `i * frameMs + timeOffsetMs`. */
  readonly frameMs: number;
  readonly timeOffsetMs: number;
  /** Active span, in frames (inclusive start, exclusive end). */
  readonly activeStart: number;
  readonly activeEnd: number;
}

/** In-place iterative radix-2 FFT of (re, im); `re.length` must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j] ?? 0, re[i] ?? 0];
      [im[i], im[j]] = [im[j] ?? 0, im[i] ?? 0];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = (-2 * Math.PI) / size;
    const half = size >> 1;
    for (let k = 0; k < half; k += 1) {
      const wr = Math.cos(step * k);
      const wi = Math.sin(step * k);
      for (let start = k; start < n; start += size) {
        const a = start;
        const b = start + half;
        const br = re[b] ?? 0;
        const bi = im[b] ?? 0;
        const tr = br * wr - bi * wi;
        const ti = br * wi + bi * wr;
        re[b] = (re[a] ?? 0) - tr;
        im[b] = (im[a] ?? 0) - ti;
        re[a] = (re[a] ?? 0) + tr;
        im[a] = (im[a] ?? 0) + ti;
      }
    }
  }
}

/**
 * Onset envelope of `samples` (mono, ANALYSIS_RATE). Frame times are the window centres shifted by a measured
 * constant: a sharp attack makes its flux peak a few frames before the window centre reaches it (the log
 * compression makes even the window's thin edge count), and the shift puts the peak back on the attack.
 */
export function onsetEnvelope(samples: Float32Array): OnsetEnvelope {
  const frames = Math.max(0, Math.floor((samples.length - FFT_SIZE) / HOP) + 1);
  const bins = FFT_SIZE / 2;
  const window = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i += 1) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE);

  const flux = new Float32Array(frames);
  const levelDb = new Float32Array(frames);
  let previous = new Float64Array(bins);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let f = 0; f < frames; f += 1) {
    const offset = f * HOP;
    let energy = 0;
    for (let i = 0; i < FFT_SIZE; i += 1) {
      const s = samples[offset + i] ?? 0;
      energy += s * s;
      re[i] = s * (window[i] ?? 0);
      im[i] = 0;
    }
    levelDb[f] = 10 * Math.log10(energy / FFT_SIZE + 1e-12);
    fftInPlace(re, im);
    const current = new Float64Array(bins);
    let sum = 0;
    for (let k = 1; k < bins; k += 1) {
      const magnitude = Math.log1p(100 * Math.hypot(re[k] ?? 0, im[k] ?? 0));
      current[k] = magnitude;
      if (f > 0) sum += Math.max(0, magnitude - (previous[k] ?? 0));
    }
    flux[f] = sum;
    previous = current;
  }

  const { start, end } = activeSpan(levelDb);
  const strength = removeTrend(flux);
  let mean = 0;
  for (let f = start; f < end; f += 1) mean += strength[f] ?? 0;
  mean /= Math.max(1, end - start);
  if (mean > 0) for (let f = 0; f < frames; f += 1) strength[f] = (strength[f] ?? 0) / mean;

  const frameMs = 1000 / FRAME_RATE;
  return { strength, frameMs, timeOffsetMs: ((FFT_SIZE / 2) * 1000) / ANALYSIS_RATE + ONSET_SHIFT_MS, activeStart: start, activeEnd: end };
}

/** Flux minus its moving average, floored at zero. */
function removeTrend(flux: Float32Array): Float32Array {
  const out = new Float32Array(flux.length);
  const half = Math.floor(TREND_FRAMES / 2);
  let windowSum = 0;
  let count = 0;
  // Running sum over [f - half, f + half].
  for (let i = 0; i <= half && i < flux.length; i += 1) {
    windowSum += flux[i] ?? 0;
    count += 1;
  }
  for (let f = 0; f < flux.length; f += 1) {
    out[f] = Math.max(0, (flux[f] ?? 0) - windowSum / count);
    const enter = f + half + 1;
    const leave = f - half;
    if (enter < flux.length) {
      windowSum += flux[enter] ?? 0;
      count += 1;
    }
    if (leave >= 0) {
      windowSum -= flux[leave] ?? 0;
      count -= 1;
    }
  }
  return out;
}

/** First and last frame within ACTIVE_RANGE_DB of the loud passages (95th percentile level). */
function activeSpan(levelDb: Float32Array): { start: number; end: number } {
  if (levelDb.length === 0) return { start: 0, end: 0 };
  const sorted = Float32Array.from(levelDb).sort();
  const loud = sorted[Math.floor(0.95 * (sorted.length - 1))] ?? 0;
  const floor = loud - ACTIVE_RANGE_DB;
  let start = 0;
  while (start < levelDb.length && (levelDb[start] ?? -Infinity) < floor) start += 1;
  let end = levelDb.length;
  while (end > start && (levelDb[end - 1] ?? -Infinity) < floor) end -= 1;
  return { start, end };
}
