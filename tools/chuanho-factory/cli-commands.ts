/**
 * The queue-editing and reporting commands of the CLI (everything except `run`). Each takes the loaded config and
 * store and prints for a human operator.
 */
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { flagNumber, flagString, type ParsedArgs } from './cli-args';
import { readJsonIfExists } from './executors/executor-context';
import { readHandoffVideos } from './executors/handoff-files';
import { voicedVerseIds } from './executors/verse-voice-job';
import type { FactoryConfig } from './factory-config';
import { createJob, jobId, requeue } from './job-queue';
import type { JobStore } from './job-store';
import { isJobStatus, type Job, type JobParams } from './job-types';
import { planRemoval, removeApiCommand } from './library-bundle';
import { mediaLayout } from './media-layout';
import { planNight } from './night-plan';
import { formatWindow } from './schedule-window';
import { loadVerses } from './verses';

const SAFE_TRACK_ID = /^[a-z0-9_-]{1,40}$/i;

export async function enqueue(config: FactoryConfig, store: JobStore, list: readonly JobParams[], now: Date): Promise<Job[]> {
  const jobs = list.map((params) => createJob(jobId(params.kind, now, randomBytes(2).toString('hex')), params, now, config.maxAttempts));
  for (const job of jobs) await store.saveJob(job);
  return jobs;
}

function describe(job: Job): string {
  const { kind, ...rest } = job.params;
  const params = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  const retry = job.status === 'pending' && job.notBefore ? ` retry after ${job.notBefore}` : '';
  const error = job.lastError ? `\n      last error: ${job.lastError.split('\n')[0]}` : '';
  const result = job.result ? `\n      ${JSON.stringify(job.result.summary)}` : '';
  return `${job.id.padEnd(36)} ${job.status.padEnd(8)} ${job.attempts}/${job.maxAttempts} ${kind}${params}${retry}${result}${error}`;
}

export async function listJobs(store: JobStore, args: ParsedArgs): Promise<void> {
  const { jobs, skippedLines } = await store.load();
  const status = flagString(args, 'status');
  if (status !== undefined && !isJobStatus(status)) throw new Error('--status must be pending, running, passed, rejected or failed');
  const shown = jobs.filter((job) => (status ? job.status === status : args.flags.has('all') || job.status !== 'passed' || Date.now() - Date.parse(job.updatedAt) < 3 * 86_400_000));
  for (const job of shown) console.log(describe(job));
  console.log(`${shown.length} shown, ${jobs.length} in the queue${skippedLines ? `, ${skippedLines} unreadable line(s) skipped` : ''} (${store.path})`);
}

export async function showStatus(config: FactoryConfig, store: JobStore): Promise<void> {
  const state = await store.load();
  const counts = new Map<string, number>();
  for (const job of state.jobs) counts.set(job.status, (counts.get(job.status) ?? 0) + 1);
  const manifest = (await readJsonIfExists(path.join(mediaLayout(config.mediaDir).library, 'manifest.json'))) as { tracks?: unknown[]; totalSeconds?: number } | undefined;
  console.log(`queue      ${store.path}`);
  console.log(`media      ${config.mediaDir}`);
  console.log(`window     ${formatWindow(config.window)} local; GPU busy above ${config.gpuBusyPercent}% for ${config.gpuBusySamples} samples`);
  console.log(`jobs       ${[...counts].map(([s, n]) => `${n} ${s}`).join(', ') || 'none'}`);
  console.log(`library    ${manifest?.tracks?.length ?? 0} tracks, ${((manifest?.totalSeconds ?? 0) / 3600).toFixed(2)} h; ${state.removals.length} removed by the operator`);
  console.log(`videos     ${(await readHandoffVideos(mediaLayout(config.mediaDir).videos)).length} in the handoff folder`);
  console.log(`asr        ${config.asrPython ? 'configured' : 'NOT configured (verse-voice jobs will fail)'}`);
  for (const job of state.jobs.slice(-5)) console.log(`  ${describe(job)}`);
}

/** "Gỡ bản": records the removal and lists what to drop locally and on the server. */
export async function rejectTrack(config: FactoryConfig, store: JobStore, args: ParsedArgs, now: Date): Promise<void> {
  const trackId = args.positional[0];
  const reason = (flagString(args, 'reason') ?? 'reported unpleasant by the owner').trim();
  if (!trackId || !SAFE_TRACK_ID.test(trackId)) throw new Error('usage: reject <trackId> [--reason "why"]');
  const layout = mediaLayout(config.mediaDir);
  const manifest = await readJsonIfExists(path.join(layout.library, 'manifest.json'));
  const plan = planRemoval(trackId, manifest, await readJsonIfExists(path.join(layout.library, 'beatmaps', 'index.json')), await readHandoffVideos(layout.videos));
  if (!plan.inManifest) console.log(`note: ${trackId} is not in the local library manifest (removal recorded anyway)`);
  await store.saveRemoval({ trackId, reason, at: now.toISOString() });
  console.log(`${trackId} marked removed (${reason}). Every later publish bundle leaves it out.`);
  console.log('Files to drop:');
  for (const file of plan.libraryFiles) console.log(`  library/${file}`);
  console.log(`  manifest.json entry ${plan.inManifest ? 'present' : 'absent'}; beatmaps/index.json entry ${plan.inBeatmapIndex ? 'present' : 'absent'}`);
  for (const video of plan.videos) console.log(`  videos/${video} uses it: do not post it (withdraw it if already posted)`);
  console.log('Next, for the operator:');
  console.log(`  1. take it off the server list now:\n     ${removeApiCommand(config.publicUrl, config.libraryEnvFile, trackId, reason)}`);
  console.log('  2. enqueue publish-library, then upload the bundle with PRUNE=1 (the command is printed by that job)');
}

export async function requeueJob(store: JobStore, args: ParsedArgs, now: Date): Promise<void> {
  const id = args.positional[0];
  const job = (await store.load()).jobs.find((j) => j.id === id);
  if (!job) throw new Error(`no job ${String(id)}`);
  await store.saveJob(requeue(job, now));
  console.log(`${job.id} back to pending`);
}

export async function planNightCommand(config: FactoryConfig, store: JobStore, args: ParsedArgs, now: Date): Promise<void> {
  const state = await store.load();
  const plan = planNight(state, {
    musicCount: flagNumber(args, 'music', 8),
    videos: flagNumber(args, 'videos', 2),
    videoSeconds: flagNumber(args, 'seconds', 30),
    verseIds: (await loadVerses()).map((v) => v.id),
    voicedVerseIds: voicedVerseIds({ state }),
    now,
  });
  if (plan.length === 0) {
    console.log('nothing to add: every kind already has a pending job');
    return;
  }
  for (const job of await enqueue(config, store, plan, now)) console.log(`queued ${describe(job)}`);
}
