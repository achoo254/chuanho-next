/**
 * `music`: N new raw tracks through tools/chuanho-music/generate_music.py (one track per call, so the runner can
 * yield the GPU between tracks), then qc_music.py over the whole raw folder, which rebuilds the library and its
 * manifest with only QC-passed tracks. Its qc-report.json is the verdict; nothing is re-checked here.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Job, MusicParams } from '../job-types';
import { batchQcItems, nextTrackNumber, parseMusicQcReport, rawTrackIds, trackIdFor } from '../music-qc-report';
import { runChecked } from '../process-runner';
import { gpuStep, outcome, readJsonIfExists, type ExecutorContext, type ExecutorOutcome } from './executor-context';

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

async function rawFiles(dir: string): Promise<Set<string>> {
  try {
    return new Set((await readdir(dir)).filter((name) => /^m\d{3,}\.mp3$/.test(name)).map((name) => name.slice(0, -4)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw error;
  }
}

export async function runMusicJob(job: Job, ctx: ExecutorContext): Promise<ExecutorOutcome> {
  const params = job.params as MusicParams;
  const { musicRaw, library } = ctx.layout;
  const tool = ctx.config.musicToolDir;
  // The batch's first track number is saved on the first attempt, so a retry finishes the same tracks
  // (generate_music.py skips files that exist; its plan is a stable prefix for a given master seed).
  const batchFile = path.join(ctx.layout.work, job.id, 'music-batch.json');
  const saved = (await readJsonIfExists(batchFile)) as { first?: unknown } | undefined;
  let first: number;
  if (typeof saved?.first === 'number' && Number.isInteger(saved.first) && saved.first > 0) {
    first = saved.first;
  } else {
    first = nextTrackNumber([...(await rawFiles(musicRaw)), ...rawTrackIds(await readText(path.join(musicRaw, 'jobs.jsonl'))).ids]);
    await mkdir(path.dirname(batchFile), { recursive: true });
    await writeFile(batchFile, `${JSON.stringify({ first })}\n`, 'utf8');
  }
  const batch = Array.from({ length: params.count }, (_, i) => trackIdFor(first + i));
  for (const [i, id] of batch.entries()) {
    await gpuStep(ctx);
    const number = String(first + i);
    ctx.log(`music ${id} (${i + 1}/${batch.length})`);
    await runChecked(ctx.run, ctx.config.python, ['generate_music.py', '--out', musicRaw, '--start', number, '--count', number], {
      cwd: tool,
      timeoutMs: 45 * 60_000,
      signal: ctx.signal,
    });
  }
  const after = await rawFiles(musicRaw);
  const generated = new Set(batch.filter((id) => after.has(id)));
  if (generated.size === 0) throw new Error(`no track of ${batch.join(', ')} was generated (see ${path.join(musicRaw, 'jobs.jsonl')})`);

  ctx.log(`qc_music over ${after.size} raw tracks`);
  // Exit 2 only means the library is still short of --hours; anything else is a failure.
  const qc = await ctx.run(
    ctx.config.python,
    ['qc_music.py', '--raw', musicRaw, '--out', library, '--hours', String(ctx.config.libraryHours), '--kbps', String(ctx.config.libraryKbps)],
    { cwd: tool, timeoutMs: 3 * 3_600_000, signal: ctx.signal },
  );
  if (qc.code !== 0 && qc.code !== 2) throw new Error(`qc_music.py exited ${qc.code}: ${qc.stderr.trim().slice(-800)}`);
  const report = parseMusicQcReport(JSON.parse(await readFile(path.join(musicRaw, 'qc-report.json'), 'utf8')));
  const items = batchQcItems(report, batch, generated);
  return outcome({
    outputs: [path.join(library, 'manifest.json')],
    qc: items,
    summary: {
      batch: batch.length,
      generated: generated.size,
      kept: items.filter((item) => item.passed).length,
      libraryTracks: report.summary.kept ?? report.kept.length,
      libraryHours: report.summary.hours ?? 0,
      libraryFull: qc.code === 0,
    },
  });
}
