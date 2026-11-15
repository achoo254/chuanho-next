/**
 * Objective audio/video QC for the kinds qc_music.py does not cover (voice clips, finished videos): duration,
 * loudness window (EBU R128 integrated loudness and true peak) and long silences. ffprobe/ffmpeg run through the
 * injected command runner; the parsers and the verdict are pure and tested on canned output.
 */
import { runChecked, type RunCommand } from './process-runner';
import type { QcCheck } from './job-types';

export interface ProbeInfo {
  readonly seconds: number;
  readonly video?: { readonly width: number; readonly height: number };
  readonly hasAudio: boolean;
}

export interface Loudness {
  readonly integratedLufs: number;
  readonly truePeakDb: number | undefined;
}

export interface Silence {
  readonly start: number;
  readonly end: number;
}

export interface AudioMeasure {
  readonly seconds: number;
  readonly loudness: Loudness;
  readonly silences: readonly Silence[];
}

export interface AudioLimits {
  readonly minSeconds: number;
  readonly maxSeconds: number;
  readonly minLufs: number;
  readonly maxLufs: number;
  readonly maxTruePeakDb: number;
  readonly maxSilenceSeconds: number;
  /** silencedetect noise floor, dB. */
  readonly silenceDb: number;
}

/** Voice-overs are shaped to -18 LUFS (like the sutra voice); a gap over 1.2 s inside a short line is a glitch. */
export const VOICE_LIMITS: AudioLimits = { minSeconds: 1, maxSeconds: 20, minLufs: -24, maxLufs: -14, maxTruePeakDb: -1, maxSilenceSeconds: 1.2, silenceDb: -45 };
/** Finished videos are normalised to -16 LUFS for the short-video apps; music never stops for 3 s. */
export const VIDEO_AUDIO_LIMITS: AudioLimits = { minSeconds: 15, maxSeconds: 61, minLufs: -20, maxLufs: -12, maxTruePeakDb: -1, maxSilenceSeconds: 3, silenceDb: -50 };

export function ffprobeArgs(file: string): string[] {
  return ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file];
}

export function parseProbe(stdout: string): ProbeInfo {
  const data = JSON.parse(stdout) as { streams?: { codec_type?: string; width?: number; height?: number }[]; format?: { duration?: string } };
  const seconds = Number(data.format?.duration);
  if (!Number.isFinite(seconds)) throw new Error('ffprobe reported no duration');
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === 'video' && typeof s.width === 'number' && typeof s.height === 'number');
  return {
    seconds,
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
    ...(video?.width && video.height ? { video: { width: video.width, height: video.height } } : {}),
  };
}

export function loudnessArgs(file: string, silenceDb: number, minSilenceSeconds: number): string[] {
  return ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', `ebur128=peak=true,silencedetect=n=${silenceDb}dB:d=${minSilenceSeconds}`, '-f', 'null', '-'];
}

/** The summary block ebur128 prints at the end ("I: -18.0 LUFS", "Peak: -1.6 dBFS"). */
export function parseEbur128(stderr: string): Loudness {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  const integrated = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(summary);
  if (!summary.startsWith('Summary:') || !integrated?.[1]) throw new Error('no ebur128 summary in ffmpeg output');
  const peak = /Peak:\s+(-?[\d.]+|-inf)\s+dBFS/.exec(summary);
  const toNumber = (text: string): number => (text === '-inf' ? Number.NEGATIVE_INFINITY : Number(text));
  return { integratedLufs: toNumber(integrated[1]), truePeakDb: peak?.[1] ? toNumber(peak[1]) : undefined };
}

/** silencedetect lines; a silence still open at the end of the file runs to `totalSeconds`. */
export function parseSilences(stderr: string, totalSeconds: number): Silence[] {
  const silences: Silence[] = [];
  let open: number | undefined;
  for (const line of stderr.split(/\r?\n/)) {
    const start = /silence_start:\s*(-?[\d.]+)/.exec(line);
    const end = /silence_end:\s*(-?[\d.]+)/.exec(line);
    if (start?.[1]) open = Math.max(0, Number(start[1]));
    if (end?.[1]) {
      silences.push({ start: open ?? 0, end: Number(end[1]) });
      open = undefined;
    }
  }
  if (open !== undefined) silences.push({ start: open, end: totalSeconds });
  return silences;
}

export async function measureAudio(run: RunCommand, file: string, limits: AudioLimits): Promise<AudioMeasure & { probe: ProbeInfo }> {
  const probe = parseProbe((await runChecked(run, 'ffprobe', ffprobeArgs(file), { timeoutMs: 60_000 })).stdout);
  if (!probe.hasAudio) throw new Error(`${file} has no audio stream`);
  // Report any silence half as long as the limit, so the detail shows near misses too.
  const pass = await runChecked(run, 'ffmpeg', loudnessArgs(file, limits.silenceDb, limits.maxSilenceSeconds / 2), { timeoutMs: 300_000 });
  return { probe, seconds: probe.seconds, loudness: parseEbur128(pass.stderr), silences: parseSilences(pass.stderr, probe.seconds) };
}

const round = (n: number): number => Math.round(n * 100) / 100;

export function evaluateAudio(measure: AudioMeasure, limits: AudioLimits): QcCheck[] {
  const { seconds, loudness } = measure;
  const longest = measure.silences.reduce((max, s) => Math.max(max, s.end - s.start), 0);
  const peak = loudness.truePeakDb;
  return [
    { name: 'duration', ok: seconds >= limits.minSeconds && seconds <= limits.maxSeconds, detail: `${round(seconds)} s (${limits.minSeconds}-${limits.maxSeconds})` },
    {
      name: 'loudness',
      ok: loudness.integratedLufs >= limits.minLufs && loudness.integratedLufs <= limits.maxLufs,
      detail: `${round(loudness.integratedLufs)} LUFS (${limits.minLufs} to ${limits.maxLufs})`,
    },
    { name: 'true-peak', ok: peak !== undefined && peak <= limits.maxTruePeakDb, detail: peak === undefined ? 'not measured' : `${round(peak)} dBFS (max ${limits.maxTruePeakDb})` },
    { name: 'silence', ok: longest <= limits.maxSilenceSeconds, detail: `longest ${round(longest)} s below ${limits.silenceDb} dB (max ${limits.maxSilenceSeconds})` },
  ];
}

export function allPassed(checks: readonly QcCheck[]): boolean {
  return checks.every((check) => check.ok);
}
