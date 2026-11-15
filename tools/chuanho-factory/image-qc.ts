/**
 * Objective checks for a scene picture: the size artgen was asked for (9:16), a real file, and enough tonal range
 * that it is not a blank or failed render (ffmpeg `signalstats` luma spread). Whether the model sneaked text in
 * cannot be measured; the prompt and negative prompt forbid it, and the operator removes a bad one.
 */
import type { QcCheck } from './job-types';

export const IMAGE_PROBE_ARGS = (file: string): string[] => ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file];
export const IMAGE_STATS_ARGS = (file: string): string[] => ['-hide_banner', '-nostats', '-i', file, '-vf', 'signalstats,metadata=mode=print', '-f', 'null', '-'];

export function parseImageSize(stdout: string): { width: number; height: number } | undefined {
  const data = JSON.parse(stdout) as { streams?: { width?: unknown; height?: unknown }[] };
  const stream = data.streams?.[0];
  return typeof stream?.width === 'number' && typeof stream.height === 'number' ? { width: stream.width, height: stream.height } : undefined;
}

/** Luma statistics printed by `metadata=mode=print` (8-bit scale). */
export function parseLumaStats(stderr: string): { min: number; max: number; avg: number } | undefined {
  const value = (key: string): number | undefined => {
    const match = new RegExp(`lavfi\\.signalstats\\.${key}=(-?[\\d.]+)`).exec(stderr);
    return match?.[1] ? Number(match[1]) : undefined;
  };
  const min = value('YLOW');
  const max = value('YHIGH');
  const avg = value('YAVG');
  return min !== undefined && max !== undefined && avg !== undefined ? { min, max, avg } : undefined;
}

export function evaluateImage(size: { width: number; height: number } | undefined, bytes: number, luma: { min: number; max: number; avg: number } | undefined, want: { width: number; height: number }): QcCheck[] {
  const ratio = size ? size.width / size.height : 0;
  const wantRatio = want.width / want.height;
  const spread = luma ? luma.max - luma.min : 0;
  return [
    { name: 'size', ok: size !== undefined && Math.abs(ratio - wantRatio) / wantRatio < 0.02 && size.height >= want.height * 0.9, detail: size ? `${size.width}x${size.height}` : 'unreadable' },
    { name: 'file', ok: bytes > 50_000, detail: `${Math.round(bytes / 1024)} KiB` },
    // YLOW/YHIGH are the 10th/90th percentiles: a flat or black frame has almost no spread.
    { name: 'tonal-range', ok: luma !== undefined && spread >= 30 && luma.avg > 12 && luma.avg < 245, detail: luma ? `luma 10-90% ${luma.min}-${luma.max}, mean ${luma.avg}` : 'not measured' },
  ];
}
