/**
 * `video`: a calm 9:16 video for Tiểu Đệ from one passed scene picture, one library track (never a removed one) and
 * optionally a passed verse voice-over, the verse burned in as a caption. Rendered in the job's work folder, checked
 * (size, duration, loudness, silence, text guard), and only then moved to `<media>/videos/<id>.mp4` with its
 * `<id>.json` sidecar. Nothing is posted anywhere.
 */
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Job, QcCheck, VideoParams } from '../job-types';
import { allPassed, evaluateAudio, measureAudio, VIDEO_AUDIO_LIMITS } from '../media-qc';
import { runChecked } from '../process-runner';
import { loadVerses } from '../verses';
import { chooseVideoInputs, libraryEntries, TRACK_START_SECONDS } from '../video-inputs';
import { HEIGHT, maxVoiceSeconds, renderArgs, WIDTH, wrapVerse } from '../video-render-args';
import { buildSidecar, sidecarTextProblems } from '../video-sidecar';
import { outcome, readJsonIfExists, type ExecutorContext, type ExecutorOutcome } from './executor-context';
import { exists, passedItems, readHandoffVideos, resolveFont } from './handoff-files';

export async function runVideoJob(job: Job, ctx: ExecutorContext): Promise<ExecutorOutcome> {
  const params = job.params as VideoParams;
  const { layout, config } = ctx;
  const past = await readHandoffVideos(layout.videos);
  const picked = chooseVideoInputs({
    scenes: await passedItems(ctx.state, 'scene', config.mediaDir),
    time: params.time,
    tracks: libraryEntries(await readJsonIfExists(path.join(layout.library, 'manifest.json'))),
    removed: new Set(ctx.state.removals.map((r) => r.trackId)),
    verses: await loadVerses(),
    past: past.map((v) => ({ trackId: v.trackId, sceneFile: v.scene.file, ...(v.verseId ? { verseId: v.verseId } : {}) })),
    seconds: params.seconds,
  });
  // Missing inputs are a failure, so the job retries later (after tonight's scene or music jobs).
  if ('missing' in picked) throw new Error(`cannot make a video yet: ${picked.missing}`);
  const { scene, track, verse } = picked;

  const voiceFile = verse && params.withVoice ? path.join(config.mediaDir, 'voices', `${verse.id}.mp3`) : undefined;
  const voice = voiceFile && (await exists(voiceFile)) ? voiceFile : undefined;
  if (voice) {
    const seconds = Number((await runChecked(ctx.run, 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice], { signal: ctx.signal })).stdout.trim());
    if (!(seconds <= maxVoiceSeconds(params.seconds))) throw new Error(`voice ${verse?.id} is ${seconds} s, too long for a ${params.seconds} s video`);
  }

  const id = `cn-${ctx.now().toISOString().replace(/[-:T]/g, '').slice(0, 12)}-${scene.time}`;
  const work = path.join(layout.work, job.id);
  await mkdir(work, { recursive: true });
  await copyFile(await resolveFont(config), path.join(work, 'font.ttf'));
  if (verse) await writeFile(path.join(work, 'verse.txt'), wrapVerse(verse.text).join('\n'), 'utf8');
  const rendered = path.join(work, `${id}.mp4`);
  ctx.log(`video ${id}: ${scene.time} scene, track ${track.id}${verse ? `, verse ${verse.id}${voice ? ' (voiced)' : ''}` : ''}`);
  await runChecked(
    ctx.run,
    'ffmpeg',
    renderArgs({
      scene: path.join(config.mediaDir, scene.file),
      track: path.join(layout.library, track.file),
      trackStartSeconds: TRACK_START_SECONDS,
      ...(voice ? { voice } : {}),
      seconds: params.seconds,
      ...(verse ? { textFile: 'verse.txt' } : {}),
      fontFile: 'font.ttf',
      output: `${id}.mp4`,
    }),
    { cwd: work, timeoutMs: 30 * 60_000, signal: ctx.signal },
  );

  const limits = { ...VIDEO_AUDIO_LIMITS, minSeconds: params.seconds - 0.5, maxSeconds: params.seconds + 0.5 };
  const measured = await measureAudio(ctx.run, rendered, limits);
  const sidecar = buildSidecar({
    id,
    durationSeconds: measured.seconds,
    width: measured.probe.video?.width ?? 0,
    height: measured.probe.video?.height ?? 0,
    trackId: track.id,
    scene,
    ...(verse ? { verse: { id: verse.id, text: verse.text, voiced: voice !== undefined } } : {}),
    created: ctx.now(),
  });
  const textProblems = sidecarTextProblems(sidecar);
  const checks: QcCheck[] = [
    { name: 'frame', ok: sidecar.width === WIDTH && sidecar.height === HEIGHT, detail: `${sidecar.width}x${sidecar.height}` },
    ...evaluateAudio(measured, limits),
    { name: 'text', ok: textProblems.length === 0, detail: textProblems.join('; ') || 'calm, no call to action' },
  ];
  const passed = allPassed(checks);
  const outputs: string[] = [];
  if (passed) {
    await mkdir(layout.videos, { recursive: true });
    const target = path.join(layout.videos, `${id}.mp4`);
    await rename(rendered, target);
    // Sidecar last: a consumer that sees <id>.json can rely on <id>.mp4 being complete.
    await writeFile(path.join(layout.videos, `${id}.json`), `${JSON.stringify(sidecar, null, 2)}\n`, 'utf8');
    outputs.push(target, path.join(layout.videos, `${id}.json`));
  }
  return outcome({
    outputs,
    qc: [{ item: `videos/${id}.mp4`, passed, checks }],
    summary: { video: id, track: track.id, scene: scene.time, verse: verse?.id ?? '', voiced: voice !== undefined, kept: passed, inspect: passed ? '' : rendered },
  });
}
