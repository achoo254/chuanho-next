/**
 * Job model of the PC production queue. A job is one unit of nightly work (a batch of music, the day's scene
 * pictures, verse voice-overs, a video, beatmaps, the publish bundle); the queue file keeps one JSON line per
 * change, the last line of an id wins (see job-store.ts).
 */

/** Kinds in the order the runner prefers them: inputs before the steps that consume them. */
export const JOB_KINDS = ['music', 'beatmap', 'scene', 'verse-voice', 'video', 'publish-library'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATUSES = ['pending', 'running', 'passed', 'rejected', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Times of day of the scene pictures, matching the game's light variants. */
export const TIMES_OF_DAY = ['morning', 'noon', 'evening', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export interface MusicParams {
  readonly kind: 'music';
  /** New raw tracks to generate in this batch. */
  readonly count: number;
}
export interface SceneParams {
  readonly kind: 'scene';
  readonly times: readonly TimeOfDay[];
}
export interface VerseVoiceParams {
  readonly kind: 'verse-voice';
  /** Verse ids from verses.json; empty means every verse without a passed voice yet. */
  readonly verseIds: readonly string[];
}
export interface VideoParams {
  readonly kind: 'video';
  readonly seconds: number;
  /** Scene time of day; missing means the scene with the fewest videos so far. */
  readonly time?: TimeOfDay;
  readonly withVoice: boolean;
}
export interface BeatmapParams {
  readonly kind: 'beatmap';
}
export interface PublishParams {
  readonly kind: 'publish-library';
}
export type JobParams = MusicParams | SceneParams | VerseVoiceParams | VideoParams | BeatmapParams | PublishParams;

/** One objective check and its verdict; `detail` is free text for the operator. */
export interface QcCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** What a finished attempt produced: files outside the repo and the QC of each item. */
export interface JobResult {
  readonly outputs: readonly string[];
  readonly qc: readonly QcItem[];
  /** Short machine-readable facts (counts, ids) shown by `status`. */
  readonly summary: Readonly<Record<string, string | number | boolean>>;
}

/** QC of one produced item (a track, a picture, a voice clip, a video). */
export interface QcItem {
  readonly item: string;
  readonly passed: boolean;
  readonly checks: readonly QcCheck[];
}

export interface Job {
  readonly id: string;
  readonly params: JobParams;
  readonly status: JobStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  /** Earliest time a retry may start (ISO); set after a failed attempt. */
  readonly notBefore?: string;
  readonly lastError?: string;
  readonly result?: JobResult;
}

/** A track taken out of the library by the operator ("gỡ bản"); publish bundles never contain it again. */
export interface TrackRemoval {
  readonly trackId: string;
  readonly reason: string;
  readonly at: string;
}

export function isJobKind(value: unknown): value is JobKind {
  return typeof value === 'string' && (JOB_KINDS as readonly string[]).includes(value);
}

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === 'string' && (TIMES_OF_DAY as readonly string[]).includes(value);
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value);
}
