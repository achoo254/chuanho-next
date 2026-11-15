/**
 * The shared music library ("kho nhạc"): the server keeps each track's metadata (length, time-of-day tags, when it was
 * added, how often it was heard, whether it was taken down) and serves a manifest of the tracks still in it. The audio
 * files themselves stay a static folder written by the operator's tooling; the API never touches them, it only says
 * which files of removed tracks may be deleted.
 *
 * REST:
 * - `GET /api/library/manifest` (public): `LibraryManifest`, the same shape as the static `manifest.json`.
 * - `GET /api/library/tracks` (public): `LibraryTracksResponse`, every track with its metadata.
 * - `POST /api/library/listen` (public, `LibraryListenInput`): one listen per track per anonymous listener per day.
 * - Operator only (Bearer token): `POST /api/library/ingest` (`LibraryIngestInput`), `POST /api/library/tracks/:id/remove`
 *   (`LibraryRemoveInput`), `POST /api/library/tracks/:id/restore`, `GET /api/library/removed`.
 */
import { cleanText, isRecord } from './primitives';

/** At most this many tracks stay in the library; ingesting past it takes down the least-heard, oldest ones. */
export const LIBRARY_MAX_TRACKS = 400;
/** Listens one client IP may report per 15 minutes (mobile carriers put many listeners behind one address). */
export const LIBRARY_LISTEN_LIMIT_PER_IP_15MIN = 120;
/** Listens the whole server accepts per minute, so a flood cannot keep the database busy. */
export const LIBRARY_LISTEN_LIMIT_GLOBAL_PER_MIN = 600;
/** A track counts as heard after this many seconds, or half of it when it is shorter (whichever comes first). */
export const LIBRARY_LISTEN_MIN_S = 30;
export const LIBRARY_LISTEN_MIN_SHARE = 0.5;
/** Shortest and longest track the library accepts, in seconds. */
export const LIBRARY_MIN_DURATION_S = 10;
export const LIBRARY_MAX_DURATION_S = 1800;
export const LIBRARY_MAX_TAGS = 12;
export const LIBRARY_REMOVE_REASON_MAX = 200;

/** A file name inside the library directory: no path, no scheme, an audio extension. */
export const LIBRARY_SAFE_FILE = /^[a-z0-9][a-z0-9._-]{0,80}\.(mp3|m4a|ogg|webm)$/i;
export const LIBRARY_SAFE_ID = /^[a-z0-9_-]{1,40}$/i;
/** A tag such as `moon`, `dawn` or `rain`. */
export const LIBRARY_SAFE_TAG = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

/** One entry of the manifest the player reads (the static `manifest.json` has the same shape). */
export interface LibraryManifestTrack {
  readonly id: string;
  readonly file: string;
  /** Seconds. */
  readonly duration: number;
  readonly tags: readonly string[];
}

export interface LibraryManifest {
  readonly tracks: readonly LibraryManifestTrack[];
}

/** A track with the metadata the server keeps. */
export interface LibraryTrack extends LibraryManifestTrack {
  /** Epoch milliseconds of the first ingest. */
  readonly addedAt: number;
  readonly listens: number;
  readonly removed: boolean;
  readonly bpm?: number;
  /** Whether Mõ Beat has a playable beatmap for it. */
  readonly playableBeatmap?: boolean;
}

export interface LibraryTracksResponse {
  readonly tracks: readonly LibraryTrack[];
}

/** One track of an ingest: the manifest entry, plus what the beat tracker found when it ran. */
export interface LibraryIngestTrack extends LibraryManifestTrack {
  readonly bpm?: number;
  readonly playableBeatmap?: boolean;
}

export interface LibraryIngestInput {
  readonly tracks: readonly LibraryIngestTrack[];
}

/** A removed track whose file the operator may delete from the library directory. */
export interface LibraryRemovedTrack {
  readonly id: string;
  readonly file: string;
  readonly reason: string;
  /** Epoch milliseconds. */
  readonly removedAt: number;
}

export interface LibraryIngestResponse {
  readonly added: number;
  readonly updated: number;
  /** Tracks in the library after the ingest (removed ones not counted). */
  readonly active: number;
  /** Tracks taken down by this ingest to stay under `LIBRARY_MAX_TRACKS`. */
  readonly pruned: readonly LibraryRemovedTrack[];
}

export interface LibraryRemovedResponse {
  readonly tracks: readonly LibraryRemovedTrack[];
}

export interface LibraryRemoveInput {
  readonly reason: string;
}

export interface LibraryListenInput {
  readonly trackId: string;
}

export interface LibraryListenResponse {
  /** False when this listener was already counted for the track today. */
  readonly counted: boolean;
}

export const isLibraryTrackId = (value: unknown): value is string => typeof value === 'string' && LIBRARY_SAFE_ID.test(value);
export const isLibraryFile = (value: unknown): value is string => typeof value === 'string' && LIBRARY_SAFE_FILE.test(value);

const isDuration = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= LIBRARY_MIN_DURATION_S && value <= LIBRARY_MAX_DURATION_S;

/** The safe, de-duplicated tags of a list (anything else is dropped), capped at `LIBRARY_MAX_TAGS`. */
export function cleanLibraryTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const tags: string[] = [];
  for (const tag of raw) {
    if (typeof tag !== 'string' || !LIBRARY_SAFE_TAG.test(tag)) continue;
    const lower = tag.toLowerCase();
    if (!tags.includes(lower)) tags.push(lower);
    if (tags.length === LIBRARY_MAX_TAGS) break;
  }
  return tags;
}

function parseIngestTrack(raw: unknown): LibraryIngestTrack | null {
  if (!isRecord(raw) || !isLibraryTrackId(raw.id) || !isLibraryFile(raw.file) || !isDuration(raw.duration)) return null;
  const { bpm, playableBeatmap } = raw;
  if (bpm !== undefined && (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0 || bpm > 400)) return null;
  if (playableBeatmap !== undefined && typeof playableBeatmap !== 'boolean') return null;
  return {
    id: raw.id,
    file: raw.file,
    duration: raw.duration,
    tags: cleanLibraryTags(raw.tags),
    ...(bpm !== undefined ? { bpm } : {}),
    ...(playableBeatmap !== undefined ? { playableBeatmap } : {}),
  };
}

/**
 * An ingest body, or null when any track is malformed, an id or a file repeats, or it lists more tracks than the
 * library holds. Strict on purpose: the operator's tooling sends it, and a half-applied manifest is worse than none.
 */
export function parseLibraryIngestInput(raw: unknown): LibraryIngestInput | null {
  if (!isRecord(raw) || !Array.isArray(raw.tracks) || raw.tracks.length === 0 || raw.tracks.length > LIBRARY_MAX_TRACKS) return null;
  const ids = new Set<string>();
  const files = new Set<string>();
  const tracks: LibraryIngestTrack[] = [];
  for (const entry of raw.tracks) {
    const track = parseIngestTrack(entry);
    if (!track || ids.has(track.id) || files.has(track.file)) return null;
    ids.add(track.id);
    files.add(track.file);
    tracks.push(track);
  }
  return { tracks };
}

export function parseLibraryListenInput(raw: unknown): LibraryListenInput | null {
  return isRecord(raw) && isLibraryTrackId(raw.trackId) ? { trackId: raw.trackId } : null;
}

export function parseLibraryRemoveInput(raw: unknown): LibraryRemoveInput | null {
  if (!isRecord(raw)) return null;
  const reason = cleanText(raw.reason, LIBRARY_REMOVE_REASON_MAX, 1);
  return reason === null ? null : { reason };
}

/** Whether `heardS` seconds of a `durationS`-second track make a listen worth counting. */
export function isLibraryListen(heardS: number, durationS: number): boolean {
  if (!Number.isFinite(heardS) || !Number.isFinite(durationS) || durationS <= 0) return false;
  return heardS >= Math.min(LIBRARY_LISTEN_MIN_S, durationS * LIBRARY_LISTEN_MIN_SHARE);
}
