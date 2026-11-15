/**
 * `plan-night`: a sensible nightly batch, purely from the queue state. Music first (the library grows), beatmaps for
 * it, scene pictures where a time of day has few, voices for verses that have none, a couple of videos, and the
 * publish bundle. A kind that already has a pending job is not queued twice.
 */
import type { QueueState } from './job-store';
import { TIMES_OF_DAY, type JobKind, type JobParams, type TimeOfDay } from './job-types';
import { sceneTimeOf } from './scene-prompts';

export interface NightOptions {
  readonly musicCount: number;
  readonly videos: number;
  readonly videoSeconds: number;
  /** Verse ids in verses.json, to tell whether every verse has a voice. */
  readonly verseIds: readonly string[];
  readonly voicedVerseIds: ReadonlySet<string>;
  readonly now: Date;
}

const SCENES_PER_TIME = 2;

function dayNumber(now: Date): number {
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
}

export function planNight(state: QueueState, options: NightOptions): JobParams[] {
  const queued = new Set<JobKind>(state.jobs.filter((j) => j.status === 'pending' || j.status === 'running').map((j) => j.params.kind));
  const plan: JobParams[] = [];
  const add = (params: JobParams): void => {
    if (!queued.has(params.kind)) plan.push(params);
  };
  const rotating = TIMES_OF_DAY[dayNumber(options.now) % TIMES_OF_DAY.length] ?? 'night';

  if (options.musicCount > 0) add({ kind: 'music', count: options.musicCount });
  add({ kind: 'beatmap' });

  const scenesPerTime = new Map<TimeOfDay, number>(TIMES_OF_DAY.map((t) => [t, 0]));
  for (const job of state.jobs) {
    if (job.params.kind !== 'scene' || job.status !== 'passed') continue;
    for (const item of job.result?.qc ?? []) {
      const time = item.passed ? sceneTimeOf(item.item) : undefined;
      if (time) scenesPerTime.set(time, (scenesPerTime.get(time) ?? 0) + 1);
    }
  }
  const thin = TIMES_OF_DAY.filter((t) => (scenesPerTime.get(t) ?? 0) < SCENES_PER_TIME);
  add({ kind: 'scene', times: thin.length > 0 ? thin : [rotating] });

  if (options.verseIds.some((id) => !options.voicedVerseIds.has(id))) add({ kind: 'verse-voice', verseIds: [] });

  // Videos are several jobs of one kind, so they bypass the one-per-kind rule but still respect a pending video.
  if (!queued.has('video')) {
    for (let i = 0; i < options.videos; i += 1) {
      const time = TIMES_OF_DAY[(dayNumber(options.now) + i) % TIMES_OF_DAY.length] ?? rotating;
      plan.push({ kind: 'video', seconds: options.videoSeconds, time, withVoice: true });
    }
  }
  add({ kind: 'publish-library' });
  return plan;
}
