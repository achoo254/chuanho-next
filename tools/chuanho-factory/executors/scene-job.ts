/**
 * `scene`: one background picture per requested time of day through artgen (`-w qwen`, 9:16, no text), each checked
 * by image-qc. Pictures land in `<media>/scenes/<time>-<stamp>-<seed>.png`; a picture that fails QC is deleted.
 */
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { evaluateImage, IMAGE_PROBE_ARGS, IMAGE_STATS_ARGS, parseImageSize, parseLumaStats } from '../image-qc';
import type { Job, QcItem, SceneParams } from '../job-types';
import { posixPath } from '../media-layout';
import { allPassed } from '../media-qc';
import { lastJsonLine, runChecked } from '../process-runner';
import { SCENE_NEGATIVE, SCENE_SIZE, scenePrompt, sceneSeed } from '../scene-prompts';
import { gpuStep, outcome, type ExecutorContext, type ExecutorOutcome } from './executor-context';

export async function runSceneJob(job: Job, ctx: ExecutorContext): Promise<ExecutorOutcome> {
  const params = job.params as SceneParams;
  await mkdir(ctx.layout.scenes, { recursive: true });
  const stamp = ctx.now().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const qc: QcItem[] = [];
  const outputs: string[] = [];
  for (const time of params.times) {
    await gpuStep(ctx);
    const seed = sceneSeed(job.id, time);
    const target = path.join(ctx.layout.scenes, `${time}-${stamp}-${seed}.png`);
    ctx.log(`scene ${time} seed ${seed}`);
    const args = [
      path.join(ctx.config.artgenDir, 'artgen.py'),
      scenePrompt(time),
      '-w', 'qwen',
      '--size', `${SCENE_SIZE.width}x${SCENE_SIZE.height}`,
      '--seed', String(seed),
      '--negative', SCENE_NEGATIVE,
      '-o', target,
    ];
    const reply = lastJsonLine((await runChecked(ctx.run, ctx.config.python, args, { timeoutMs: 15 * 60_000, signal: ctx.signal })).stdout);
    const file = Array.isArray(reply?.files) && typeof reply.files[0] === 'string' ? reply.files[0] : undefined;
    if (reply?.ok !== true || !file) throw new Error(`artgen failed for ${time}: ${typeof reply?.error === 'string' ? reply.error : 'no file'}`);
    const size = parseImageSize((await runChecked(ctx.run, 'ffprobe', IMAGE_PROBE_ARGS(file), { signal: ctx.signal })).stdout);
    const luma = parseLumaStats((await runChecked(ctx.run, 'ffmpeg', IMAGE_STATS_ARGS(file), { signal: ctx.signal })).stderr);
    const checks = evaluateImage(size, (await stat(file)).size, luma, SCENE_SIZE);
    const passed = allPassed(checks);
    const relative = posixPath(path.relative(ctx.config.mediaDir, file));
    qc.push({ item: relative, passed, checks });
    if (passed) outputs.push(file);
    else await rm(file, { force: true });
  }
  return outcome({ outputs, qc, summary: { pictures: outputs.length, requested: params.times.length } });
}
