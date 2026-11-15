/**
 * `beatmap`: runs tools/chuanho-beatmap/cli.ts over the library (writes `<library>/beatmaps/`). A track that cannot
 * be played in Mõ Beat stays in the library for the radio; its QC item records "not playable".
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Job, QcItem } from '../job-types';
import { runChecked } from '../process-runner';
import { outcome, type ExecutorContext, type ExecutorOutcome } from './executor-context';

export function parseBeatmapSummary(stdout: string): { analysed: number; playable: number; failed: number } | undefined {
  const match = /(\d+) analysed, (\d+) playable, (\d+) failed/.exec(stdout);
  return match ? { analysed: Number(match[1]), playable: Number(match[2]), failed: Number(match[3]) } : undefined;
}

export function beatmapQcItems(index: unknown): QcItem[] {
  const tracks = typeof index === 'object' && index !== null ? (index as { tracks?: unknown }).tracks : undefined;
  if (!Array.isArray(tracks)) return [];
  return tracks.flatMap((t: unknown) => {
    const r = typeof t === 'object' && t !== null ? (t as Record<string, unknown>) : {};
    if (typeof r.trackId !== 'string') return [];
    const playable = r.playable === true;
    return [{ item: `beatmaps/${r.trackId}.json`, passed: true, checks: [{ name: 'playable', ok: playable, detail: playable ? `${String(r.bpm)} bpm` : 'radio only (beat too weak)' }] }];
  });
}

export async function runBeatmapJob(_job: Job, ctx: ExecutorContext): Promise<ExecutorOutcome> {
  const library = ctx.layout.library;
  const cli = path.join(ctx.config.repoRoot, 'tools', 'chuanho-beatmap', 'cli.ts');
  // Same Node, tsx resolved from the chuanho-next checkout (its devDependency).
  const result = await runChecked(ctx.run, process.execPath, ['--import', 'tsx', cli, library], { cwd: ctx.config.repoRoot, timeoutMs: 60 * 60_000, signal: ctx.signal });
  const summary = parseBeatmapSummary(result.stdout);
  if (!summary) throw new Error(`beatmap CLI printed no summary: ${result.stdout.trim().slice(-400)}`);
  const index: unknown = JSON.parse(await readFile(path.join(library, 'beatmaps', 'index.json'), 'utf8'));
  return outcome({ outputs: [path.join(library, 'beatmaps')], qc: beatmapQcItems(index), summary });
}
