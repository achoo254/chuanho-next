/**
 * Picks what a video is made of, purely: the least-used scene (of the asked time of day), the least-used library
 * track long enough for the video (never a removed one), and the least-used verse that suits the scene. Usage is
 * counted from the sidecars already in the handoff folder, so consecutive videos vary.
 */
import type { TimeOfDay } from './job-types';
import { sceneTimeOf } from './scene-prompts';
import type { Verse } from './verses';
import { versesFor } from './verses';

export interface LibraryEntry {
  readonly id: string;
  readonly file: string;
  readonly duration: number;
}

export interface PastVideo {
  readonly trackId: string;
  readonly sceneFile: string;
  readonly verseId?: string;
}

export interface VideoInputs {
  readonly scene: { readonly file: string; readonly time: TimeOfDay };
  readonly track: LibraryEntry;
  readonly verse: Verse | undefined;
}

/** Seconds skipped at the start of a track (the library's 2 s fade-in and the first quiet notes). */
export const TRACK_START_SECONDS = 4;

function leastUsed<T>(items: readonly T[], uses: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestUses = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const n = uses(item);
    if (n < bestUses) {
      best = item;
      bestUses = n;
    }
  }
  return best;
}

export function libraryEntries(manifest: unknown): LibraryEntry[] {
  const tracks = typeof manifest === 'object' && manifest !== null ? (manifest as { tracks?: unknown }).tracks : undefined;
  if (!Array.isArray(tracks)) return [];
  return tracks.flatMap((t: unknown) => {
    const r = typeof t === 'object' && t !== null ? (t as Record<string, unknown>) : {};
    return typeof r.id === 'string' && typeof r.file === 'string' && typeof r.duration === 'number' ? [{ id: r.id, file: r.file, duration: r.duration }] : [];
  });
}

export function chooseVideoInputs(input: {
  readonly scenes: readonly string[];
  readonly time: TimeOfDay | undefined;
  readonly tracks: readonly LibraryEntry[];
  readonly removed: ReadonlySet<string>;
  readonly verses: readonly Verse[];
  readonly past: readonly PastVideo[];
  readonly seconds: number;
}): VideoInputs | { missing: string } {
  const count = <K extends keyof PastVideo>(key: K, value: PastVideo[K]): number => input.past.filter((p) => p[key] === value).length;
  // Newest scenes last in the list; reverse so ties go to the newest picture.
  const scenes = [...input.scenes]
    .reverse()
    .map((file) => ({ file, time: sceneTimeOf(file) }))
    .filter((s): s is { file: string; time: TimeOfDay } => s.time !== undefined && (!input.time || s.time === input.time));
  const scene = leastUsed(scenes, (s) => count('sceneFile', s.file));
  if (!scene) return { missing: input.time ? `no passed ${input.time} scene picture` : 'no passed scene picture' };
  const long = input.tracks.filter((t) => !input.removed.has(t.id) && t.duration >= input.seconds + TRACK_START_SECONDS + 1);
  const track = leastUsed(long, (t) => count('trackId', t.id));
  if (!track) return { missing: `no library track of at least ${input.seconds + TRACK_START_SECONDS + 1} s` };
  const verse = leastUsed(versesFor(input.verses, scene.time), (v) => count('verseId', v.id));
  return { scene, track, verse };
}
