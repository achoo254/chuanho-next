/**
 * Mõ Beat charts of the music library, made per track by tools/chuanho-beatmap and served next to the tracks:
 * `<MUSIC_BASE>beatmaps/index.json` (`{ version: 1, tracks: [{ trackId, bpm, durationMs, playable }] }`) and
 * `<MUSIC_BASE>beatmaps/<trackId>.json` (`{ version: 1, trackId, bpm, offsetMs, confidence, playable, levels }`).
 * Validated here because they come over the network: a malformed entry is dropped, a malformed beatmap is refused,
 * never trusted. A track is offered only when its index entry is playable and the music manifest lists it.
 *
 * Results are cached for the page's life; a failed load is not cached, so the next visit to Mõ Beat tries again.
 * The files are fetched with `no-cache` (revalidated each time): a re-run of the tool keeps the same file names.
 */
import { DIFFICULTIES, type Difficulty } from '../game/beat-pattern';
import { MUSIC_BASE, type MusicTrack, loadMusicManifest } from './music-manifest';

export const BEATMAP_VERSION = 1;

export interface BeatmapIndexEntry {
  readonly trackId: string;
  readonly bpm: number;
  readonly durationMs: number;
  readonly playable: boolean;
}

/** A playable beatmap (unplayable ones are refused by the parser). */
export interface LibraryBeatmap {
  readonly trackId: string;
  readonly bpm: number;
  /** File time (ms) of the first downbeat. */
  readonly offsetMs: number;
  /** Note times per level, ms from the start of the file, strictly ascending. */
  readonly levels: Readonly<Record<Difficulty, readonly number[]>>;
}

/** A library track Mõ Beat can play. */
export interface BeatLibraryTrack {
  readonly track: MusicTrack;
  readonly durationMs: number;
}

const SAFE_ID = /^[a-z0-9_-]{1,40}$/i;
const MIN_BPM = 30;
const MAX_BPM = 300;
const MAX_MS = 30 * 60_000;
const MAX_NOTES = 10_000;

const isRecord = (raw: unknown): raw is Record<string, unknown> => typeof raw === 'object' && raw !== null && !Array.isArray(raw);
const isMs = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_MS;
const isBpm = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= MIN_BPM && value <= MAX_BPM;

function parseIndexEntry(raw: unknown): BeatmapIndexEntry | null {
  if (!isRecord(raw)) return null;
  const { trackId, bpm, durationMs, playable } = raw;
  if (typeof trackId !== 'string' || !SAFE_ID.test(trackId) || typeof playable !== 'boolean' || !isMs(durationMs)) return null;
  // An unplayable track may carry any tempo (0 when none was found); it is never used.
  if (playable && !isBpm(bpm)) return null;
  return { trackId, bpm: typeof bpm === 'number' && Number.isFinite(bpm) ? bpm : 0, durationMs, playable };
}

/** The valid, de-duplicated entries of a beatmap index, or null when it is not an index at all. */
export function parseBeatmapIndex(raw: unknown): BeatmapIndexEntry[] | null {
  if (!isRecord(raw) || raw.version !== BEATMAP_VERSION || !Array.isArray(raw.tracks)) return null;
  const seen = new Set<string>();
  const entries: BeatmapIndexEntry[] = [];
  for (const item of raw.tracks) {
    const entry = parseIndexEntry(item);
    if (entry && !seen.has(entry.trackId)) {
      seen.add(entry.trackId);
      entries.push(entry);
    }
  }
  return entries;
}

function parseLevel(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_NOTES) return null;
  const times: number[] = [];
  for (const value of raw) {
    const previous = times[times.length - 1];
    if (!isMs(value) || (previous !== undefined && value <= previous)) return null;
    times.push(value);
  }
  return times;
}

/** The beatmap of `trackId` when it is a well-formed, playable version-1 beatmap of that track; else null. */
export function parseBeatmap(raw: unknown, trackId: string): LibraryBeatmap | null {
  if (!isRecord(raw) || raw.version !== BEATMAP_VERSION || raw.trackId !== trackId || raw.playable !== true) return null;
  const { bpm, offsetMs, levels } = raw;
  if (!isBpm(bpm) || !isMs(offsetMs) || !isRecord(levels)) return null;
  const parsed: Partial<Record<Difficulty, number[]>> = {};
  for (const difficulty of DIFFICULTIES) {
    const level = parseLevel(levels[difficulty]);
    if (!level) return null;
    parsed[difficulty] = level;
  }
  const { easy, normal, hard } = parsed;
  if (!easy || !normal || !hard) return null;
  return { trackId, bpm, offsetMs, levels: { easy, normal, hard } };
}

/** The playable index entries the manifest also lists, joined with their track (manifest order). */
export function joinCatalog(tracks: readonly MusicTrack[], index: readonly BeatmapIndexEntry[]): BeatLibraryTrack[] {
  const playable = new Map(index.filter((entry) => entry.playable).map((entry) => [entry.trackId, entry]));
  const catalog: BeatLibraryTrack[] = [];
  for (const track of tracks) {
    const entry = playable.get(track.id);
    if (entry) catalog.push({ track, durationMs: entry.durationMs });
  }
  return catalog;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // A missing file may come back as the SPA's index.html (status 200): json() then throws, which is the check.
  return response.json();
}

let catalogRequest: Promise<BeatLibraryTrack[]> | null = null;
const beatmapRequests = new Map<string, Promise<LibraryBeatmap | null>>();

/** The library tracks Mõ Beat can play; empty when the library or its beatmaps are unavailable. */
export function loadBeatLibrary(base: string = MUSIC_BASE): Promise<BeatLibraryTrack[]> {
  catalogRequest ??= (async (): Promise<BeatLibraryTrack[]> => {
    try {
      const [tracks, index] = await Promise.all([loadMusicManifest(base), fetchJson(`${base}beatmaps/index.json`).then(parseBeatmapIndex)]);
      return tracks && index ? joinCatalog(tracks, index) : [];
    } catch (error) {
      console.warn('Mõ Beat library songs unavailable, using the built-in song', error);
      return [];
    }
  })().then((catalog) => {
    if (catalog.length === 0) catalogRequest = null;
    return catalog;
  });
  return catalogRequest;
}

/** One track's beatmap, or null when it cannot be fetched or is not valid. */
export function loadLibraryBeatmap(trackId: string, base: string = MUSIC_BASE): Promise<LibraryBeatmap | null> {
  const cached = beatmapRequests.get(trackId);
  if (cached) return cached;
  const request = fetchJson(`${base}beatmaps/${encodeURIComponent(trackId)}.json`)
    .then((raw) => parseBeatmap(raw, trackId))
    .catch((error: unknown) => {
      console.warn(`Beatmap ${trackId} unavailable`, error);
      return null;
    })
    .then((beatmap) => {
      if (!beatmap) beatmapRequests.delete(trackId);
      return beatmap;
    });
  beatmapRequests.set(trackId, request);
  return request;
}
