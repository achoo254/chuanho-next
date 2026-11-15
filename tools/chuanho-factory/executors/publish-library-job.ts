/**
 * `publish-library`: assembles `<media>/publish/library` from the library: only tracks qc_music kept, minus the
 * ones the operator removed, their beatmaps and a matching manifest and index. It does NOT upload: the job result
 * and the log carry the exact upload-music.sh command for the operator.
 */
import { copyFile, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Job } from '../job-types';
import { planBundle, uploadCommand } from '../library-bundle';
import { posixPath } from '../media-layout';
import { parseMusicQcReport } from '../music-qc-report';
import { outcome, readJsonIfExists, type ExecutorContext, type ExecutorOutcome } from './executor-context';

export async function runPublishJob(job: Job, ctx: ExecutorContext): Promise<ExecutorOutcome> {
  const { library, publish, musicRaw } = ctx.layout;
  const manifest = await readJsonIfExists(path.join(library, 'manifest.json'));
  if (manifest === undefined) throw new Error(`no library yet (${path.join(library, 'manifest.json')} is missing)`);
  const report = await readJsonIfExists(path.join(musicRaw, 'qc-report.json'));
  const plan = planBundle({
    manifest,
    beatmapIndex: await readJsonIfExists(path.join(library, 'beatmaps', 'index.json')),
    qcKept: report === undefined ? undefined : new Set(parseMusicQcReport(report).kept),
    removed: new Map(ctx.state.removals.map((r) => [r.trackId, r.reason])),
    existingFiles: new Set(await readdir(library)),
  });
  if (plan.trackFiles.length === 0) throw new Error('the bundle would hold no track');

  // Build next to the old bundle, then swap, so an interrupted run never leaves a half bundle behind.
  const staging = `${publish}.tmp-${job.id}`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(path.join(staging, 'beatmaps'), { recursive: true });
  for (const file of plan.trackFiles) await copyFile(path.join(library, file), path.join(staging, file));
  if (plan.beatmapIndex) {
    for (const file of plan.beatmapFiles) await copyFile(path.join(library, 'beatmaps', file), path.join(staging, 'beatmaps', file));
    await writeFile(path.join(staging, 'beatmaps', 'index.json'), `${JSON.stringify(plan.beatmapIndex)}\n`, 'utf8');
  } else {
    await rm(path.join(staging, 'beatmaps'), { recursive: true, force: true });
  }
  await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(plan.manifest, null, 1), 'utf8');
  await rm(`${publish}.old`, { recursive: true, force: true });
  await rename(publish, `${publish}.old`).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  await rename(staging, publish);
  await rm(`${publish}.old`, { recursive: true, force: true });

  const command = uploadCommand(posixPath(publish), ctx.state.removals.length > 0);
  for (const line of plan.dropped) ctx.log(`left out ${line}`);
  ctx.log(`bundle ready (not uploaded). Upload from the chuanho-next checkout:\n  ${command}`);
  return outcome({
    outputs: [publish],
    qc: [{ item: 'publish/library', passed: true, checks: [{ name: 'bundle', ok: true, detail: `${plan.trackFiles.length} tracks, ${plan.beatmapFiles.length} beatmaps, ${plan.dropped.length} left out` }] }],
    summary: { tracks: plan.trackFiles.length, beatmaps: plan.beatmapFiles.length, hours: Math.round((plan.totalSeconds / 3600) * 100) / 100, leftOut: plan.dropped.length, uploadCommand: command },
  });
}
