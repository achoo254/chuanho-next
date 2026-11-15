/**
 * Reading the factory's own outputs back: handoff video sidecars, passed scene pictures and voices, the caption
 * font. Shared by the video job, `reject` and `status`.
 */
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { FactoryConfig } from '../factory-config';
import type { QueueState } from '../job-store';
import type { JobKind } from '../job-types';
import { readSidecar } from '../video-sidecar';

export type HandoffVideo = NonNullable<ReturnType<typeof readSidecar>>;

export async function readHandoffVideos(videosDir: string): Promise<HandoffVideo[]> {
  let names: string[];
  try {
    names = await readdir(videosDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const videos: HandoffVideo[] = [];
  for (const name of names.filter((n) => n.endsWith('.json')).sort()) {
    try {
      const sidecar = readSidecar(JSON.parse(await readFile(path.join(videosDir, name), 'utf8')));
      if (sidecar) videos.push(sidecar);
    } catch {
      // not ours or half written; ignore
    }
  }
  return videos;
}

export async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Media-relative paths of passed QC items of passed jobs of one kind, oldest first, still on disk. */
export async function passedItems(state: QueueState, kind: JobKind, mediaDir: string): Promise<string[]> {
  const items = state.jobs
    .filter((job) => job.params.kind === kind && job.status === 'passed')
    .flatMap((job) => (job.result?.qc ?? []).filter((item) => item.passed).map((item) => item.item));
  const unique = [...new Set(items)];
  const present = await Promise.all(unique.map((item) => exists(path.join(mediaDir, item))));
  return unique.filter((_, i) => present[i]);
}

/** Be Vietnam Pro as a single full TTF: the configured file, else the one shipped with the artgen skill. */
export async function resolveFont(config: FactoryConfig): Promise<string> {
  if (config.fontFile) {
    if (await exists(config.fontFile)) return config.fontFile;
    throw new Error(`fontFile ${config.fontFile} does not exist`);
  }
  const dir = path.join(config.artgenDir, 'fonts');
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => /^BeVietnamPro-.*\.ttf$/i.test(n));
  // Lighter weights read calmer; take the lightest one available.
  const order = ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold'];
  names.sort((a, b) => (order.findIndex((w) => a.includes(`-${w}.`)) + 1 || 99) - (order.findIndex((w) => b.includes(`-${w}.`)) + 1 || 99));
  const first = names[0];
  if (!first) {
    // The web app's @fontsource copy is split into latin/vietnamese subsets (WOFF), which drawtext cannot combine.
    throw new Error(`no Be Vietnam Pro TTF in ${dir}; set fontFile in config.json to a full BeVietnamPro-*.ttf`);
  }
  return path.join(dir, first);
}
