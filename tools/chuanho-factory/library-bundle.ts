/**
 * The publish bundle and the "gỡ bản" plan, both pure. The bundle is the library minus removed tracks (and minus
 * anything qc-report.json did not keep, as a second guard): manifest, the track files it names, and the beatmaps
 * of those tracks with a matching index. upload-music.sh sends that folder; the factory never uploads.
 */
import { parseLibraryManifest } from '../chuanho-beatmap/library-manifest';

export interface BundlePlan {
  readonly manifest: Record<string, unknown>;
  readonly trackFiles: readonly string[];
  /** Beatmap file names (`<id>.json`) to copy; empty when the library has no beatmaps. */
  readonly beatmapFiles: readonly string[];
  /** undefined when the library has no beatmaps/index.json. */
  readonly beatmapIndex: Record<string, unknown> | undefined;
  /** "m012: removed by the operator (harsh hiss)" and similar, for the log. */
  readonly dropped: readonly string[];
  readonly totalSeconds: number;
}

export interface BundleInput {
  readonly manifest: unknown;
  readonly beatmapIndex: unknown;
  /** Track ids qc-report.json kept; undefined when there is no report (the manifest is trusted then). */
  readonly qcKept: ReadonlySet<string> | undefined;
  readonly removed: ReadonlyMap<string, string>;
  readonly existingFiles: ReadonlySet<string>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function planBundle(input: BundleInput): BundlePlan {
  const { tracks, skipped } = parseLibraryManifest(input.manifest);
  const dropped = skipped.map((line) => `manifest ${line}`);
  const keep = new Set<string>();
  for (const track of tracks) {
    const reason = input.removed.get(track.id);
    if (reason !== undefined) dropped.push(`${track.id}: removed by the operator (${reason})`);
    else if (input.qcKept && !input.qcKept.has(track.id)) dropped.push(`${track.id}: not kept by qc_music`);
    else if (!input.existingFiles.has(track.file)) dropped.push(`${track.id}: ${track.file} is missing`);
    else keep.add(track.id);
  }
  const rawTracks = Array.isArray(asRecord(input.manifest).tracks) ? (asRecord(input.manifest).tracks as unknown[]) : [];
  const seen = new Set<string>();
  const keptEntries = rawTracks.filter((entry) => {
    const id = asRecord(entry).id;
    if (typeof id !== 'string' || !keep.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const totalSeconds = Math.round(keptEntries.reduce((sum: number, entry: unknown): number => sum + (Number(asRecord(entry).duration) || 0), 0) * 10) / 10;
  const manifest = { ...asRecord(input.manifest), totalSeconds, tracks: keptEntries };
  const trackFiles = keptEntries.map((entry) => String(asRecord(entry).file));

  let beatmapIndex: Record<string, unknown> | undefined;
  let beatmapFiles: string[] = [];
  const index = asRecord(input.beatmapIndex);
  if (Array.isArray(index.tracks)) {
    const entries = index.tracks.filter((entry) => {
      const id = asRecord(entry).trackId;
      return typeof id === 'string' && keep.has(id);
    });
    beatmapIndex = { ...index, tracks: entries };
    beatmapFiles = entries.map((entry) => `${String(asRecord(entry).trackId)}.json`);
  }
  return { manifest, trackFiles, beatmapFiles, beatmapIndex, dropped, totalSeconds };
}

export interface RemovalPlan {
  readonly trackId: string;
  /** Files to drop from the local library (relative to it). */
  readonly libraryFiles: readonly string[];
  readonly inManifest: boolean;
  readonly inBeatmapIndex: boolean;
  /** Finished videos that use the track (handoff folder), for the operator to withdraw if already posted. */
  readonly videos: readonly string[];
}

export interface VideoUse {
  readonly id: string;
  readonly trackId: string;
}

export function planRemoval(trackId: string, manifest: unknown, beatmapIndex: unknown, videos: readonly VideoUse[]): RemovalPlan {
  const entry = (Array.isArray(asRecord(manifest).tracks) ? (asRecord(manifest).tracks as unknown[]) : []).map(asRecord).find((t) => t.id === trackId);
  const inBeatmapIndex = Array.isArray(asRecord(beatmapIndex).tracks) && (asRecord(beatmapIndex).tracks as unknown[]).some((t) => asRecord(t).trackId === trackId);
  const libraryFiles = [...(typeof entry?.file === 'string' ? [entry.file] : []), ...(inBeatmapIndex ? [`beatmaps/${trackId}.json`] : [])];
  return {
    trackId,
    libraryFiles,
    inManifest: entry !== undefined,
    inBeatmapIndex,
    videos: videos.filter((v) => v.trackId === trackId).map((v) => `${v.id}.mp4`),
  };
}

/** Shell-quote one argument for Git Bash. */
export function shellQuote(text: string): string {
  return /^[\w@%+=:,./-]+$/.test(text) ? text : `'${text.replace(/'/g, `'\\''`)}'`;
}

/** The operator's upload command; PRUNE=1 when tracks were removed so the server drops them too. */
export function uploadCommand(bundleDir: string, prune: boolean): string {
  return `SSH_TARGET=<alias> SSH_OPTS="-F <ssh_config>"${prune ? ' PRUNE=1' : ''} bash infra/upload-music.sh ${shellQuote(bundleDir)}`;
}

/**
 * The library API call that takes a track off the server's list ("gỡ bản"). The token is read from the env file at
 * run time into a shell variable and never printed; the API checks `Origin` against the public URL.
 */
export function removeApiCommand(publicUrl: string, envFile: string | undefined, trackId: string, reason: string): string {
  const file = envFile ? shellQuote(envFile) : '<env file with LIBRARY_ADMIN_TOKEN>';
  const body = shellQuote(JSON.stringify({ reason }));
  return [
    `TOKEN="$(grep -m1 '^LIBRARY_ADMIN_TOKEN=' ${file} | cut -d= -f2- | tr -d '\\r')"`,
    `curl -sS -X POST -H "Origin: ${publicUrl}" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d ${body} ${publicUrl}/api/library/tracks/${trackId}/remove`,
    'unset TOKEN',
  ].join('; ');
}
