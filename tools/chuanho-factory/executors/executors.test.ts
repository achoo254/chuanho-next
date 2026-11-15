import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../factory-config';
import { createJob, markRunning } from '../job-queue';
import type { JobParams } from '../job-types';
import { mediaLayout } from '../media-layout';
import type { CommandResult, RunCommand } from '../process-runner';
import { StopRequested, type ExecutorContext } from './executor-context';
import { runMusicJob } from './music-job';
import { runSceneJob } from './scene-job';

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function context(run: RunCommand, gpuSteps = Number.POSITIVE_INFINITY): Promise<ExecutorContext & { calls: string[][]; logs: string[] }> {
  const home = await mkdtemp(path.join(os.tmpdir(), 'chuanho-factory-exec-'));
  dirs.push(home);
  const config = resolveConfig({ env: { CHUANHO_FACTORY_HOME: home }, home, platform: 'linux', repoRoot: home, file: { python: 'py' }, artgenEnv: '' });
  const calls: string[][] = [];
  const logs: string[] = [];
  let steps = 0;
  return {
    calls,
    logs,
    config,
    layout: mediaLayout(config.mediaDir),
    run: (command, args, options) => {
      calls.push([command, ...args]);
      return run(command, args, options);
    },
    now: () => new Date('2026-11-15T16:30:00Z'),
    log: (m) => logs.push(m),
    waitForGpu: () => Promise.resolve(++steps <= gpuSteps),
    signal: new AbortController().signal,
    state: { jobs: [], removals: [], skippedLines: 0 },
  };
}

const ok = (stdout = '', stderr = ''): Promise<CommandResult> => Promise.resolve({ code: 0, stdout, stderr });
const job = (params: JobParams) => markRunning(createJob('job-1', params, new Date('2026-11-15T16:00:00Z'), 3), new Date('2026-11-15T16:00:00Z'));

describe('music job', () => {
  it('generates one track per call after the existing ones, then reads qc_music verdicts', async () => {
    const ctx = await context(async (command, args) => {
      const raw = ctx.layout.musicRaw;
      if (args[0] === 'generate_music.py') {
        const n = Number(args[args.indexOf('--start') + 1]);
        if (n === 4) await writeFile(path.join(raw, 'm004.mp3'), 'x'); // m005 fails in ComfyUI: no file
        return ok();
      }
      if (args[0] === 'qc_music.py') {
        await writeFile(path.join(raw, 'qc-report.json'), JSON.stringify({ rejected: {}, duplicates: {}, kept: ['m001', 'm004'], unused: [], summary: { kept: 2, hours: 0.1 } }));
        return { code: 2, stdout: '', stderr: '' }; // library still short of --hours: not a failure
      }
      throw new Error(`unexpected ${command}`);
    });
    await mkdir(ctx.layout.musicRaw, { recursive: true });
    await writeFile(path.join(ctx.layout.musicRaw, 'm001.mp3'), 'x');
    await writeFile(path.join(ctx.layout.musicRaw, 'jobs.jsonl'), '{"id":"m001"}\n{"id":"m003","error":"timeout"}\n');
    const outcome = await runMusicJob(job({ kind: 'music', count: 2 }), ctx);
    expect(ctx.calls.filter((c) => c[1] === 'generate_music.py').map((c) => c.slice(-4))).toEqual([
      ['--start', '4', '--count', '4'],
      ['--start', '5', '--count', '5'],
    ]);
    expect(outcome.status).toBe('passed');
    expect(outcome.result.qc.map((i) => [i.item, i.passed])).toEqual([
      ['m004', true],
      ['m005', false],
    ]);
    expect(outcome.result.summary).toMatchObject({ generated: 1, kept: 1, libraryFull: false });
  });

  it('keeps the same batch on retry, fails when nothing was generated, and stops between tracks', async () => {
    const ctx = await context(() => ok(), 1);
    await expect(runMusicJob(job({ kind: 'music', count: 2 }), ctx)).rejects.toBeInstanceOf(StopRequested);
    const retry = await context(() => ok());
    const sameWork = { ...retry, layout: ctx.layout };
    await expect(runMusicJob(job({ kind: 'music', count: 2 }), sameWork)).rejects.toThrow(/no track of m001, m002/);
  });
});

describe('scene job', () => {
  it('draws each time of day with artgen and keeps only pictures that pass QC', async () => {
    const ctx = await context(async (command, args) => {
      if (command === 'py') {
        const out = args[args.indexOf('-o') + 1] ?? '';
        await writeFile(out, Buffer.alloc(args[1]?.includes('night') ? 90_000 : 1000));
        return ok(`{"ok": true, "files": [${JSON.stringify(out)}], "seed": 1}`);
      }
      if (command === 'ffprobe') return ok(JSON.stringify({ streams: [{ width: 928, height: 1664 }] }));
      return ok('', 'lavfi.signalstats.YLOW=40 lavfi.signalstats.YAVG=90 lavfi.signalstats.YHIGH=170');
    });
    const outcome = await runSceneJob(job({ kind: 'scene', times: ['morning', 'night'] }), ctx);
    const artgen = ctx.calls.find((c) => c[0] === 'py') ?? [];
    expect(artgen).toEqual(expect.arrayContaining(['-w', 'qwen', '--size', '928x1664', '--negative']));
    expect(outcome.result.qc.map((i) => [i.item.split('-')[0], i.passed])).toEqual([
      ['scenes/morning', false],
      ['scenes/night', true],
    ]);
    expect(await readdir(ctx.layout.scenes)).toHaveLength(1); // the failed picture is deleted
  });

  it('fails the attempt when artgen reports an error', async () => {
    const ctx = await context(() => ok('{"ok": false, "error": "PC offline"}'));
    await expect(runSceneJob(job({ kind: 'scene', times: ['noon'] }), ctx)).rejects.toThrow(/PC offline/);
  });
});
