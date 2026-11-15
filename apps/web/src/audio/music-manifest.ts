/**
 * The music library's manifest: first the library API (`/api/library/manifest`, tracks still in the library), then
 * the static file next to the tracks at /media/music/manifest.json (kept on the server, not in the release: see
 * docs/deployment-guide.md). Validated here because it comes over the network: entries with a bad shape or an unsafe
 * file name are dropped, never trusted. Either way the files are served from `MUSIC_BASE`.
 */
import { LIBRARY_MAX_DURATION_S, LIBRARY_MIN_DURATION_S, LIBRARY_SAFE_FILE, LIBRARY_SAFE_ID } from '@chuanho/contract';

export interface MusicTrack {
  readonly id: string;
  /** File name inside the library directory (no path). */
  readonly file: string;
  /** Seconds. */
  readonly duration: number;
  readonly tags: readonly string[];
}

/** Where the library lives; a build can point elsewhere with VITE_MUSIC_BASE (ending in "/"). */
const configuredBase: unknown = import.meta.env.VITE_MUSIC_BASE;
export const MUSIC_BASE: string = typeof configuredBase === 'string' && configuredBase.endsWith('/') ? configuredBase : '/media/music/';

/** The shared library's manifest, served by the app's own server. */
export const LIBRARY_MANIFEST_URL = '/api/library/manifest';

function parseTrack(raw: unknown): MusicTrack | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, file, duration, tags } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || !LIBRARY_SAFE_ID.test(id)) return null;
  if (typeof file !== 'string' || !LIBRARY_SAFE_FILE.test(file)) return null;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < LIBRARY_MIN_DURATION_S || duration > LIBRARY_MAX_DURATION_S) return null;
  const cleanTags = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  return { id, file, duration, tags: cleanTags };
}

/** The valid, de-duplicated tracks of a manifest (`{ tracks: [...] }`), or null when it is not a manifest at all. */
export function parseMusicManifest(raw: unknown): MusicTrack[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const list = (raw as { tracks?: unknown }).tracks;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const tracks: MusicTrack[] = [];
  for (const entry of list) {
    const track = parseTrack(entry);
    if (track && !seen.has(track.id)) {
      seen.add(track.id);
      tracks.push(track);
    }
  }
  return tracks;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** The valid tracks of one manifest URL; throws when it is unreachable, not JSON (the SPA's index.html) or empty. */
async function fetchManifest(url: string, fetchImpl: FetchLike, signal: AbortSignal | undefined): Promise<MusicTrack[]> {
  const response = await fetchImpl(url, { cache: 'no-cache', ...(signal ? { signal } : {}) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  // A missing manifest may come back as the SPA's index.html (status 200): json() then throws, which is the check.
  const tracks = parseMusicManifest(await response.json());
  if (!tracks || tracks.length === 0) throw new Error('empty manifest');
  return tracks;
}

/**
 * Fetches and validates the manifest: the library API first, the static `manifest.json` under `base` when the API is
 * unreachable, answers something else than a manifest, or lists no track. Null when neither has tracks (offline, dev
 * server without a library), so the caller plays the bundled loop.
 */
export async function loadMusicManifest(base: string = MUSIC_BASE, signal?: AbortSignal, fetchImpl: FetchLike = (input, init) => fetch(input, init)): Promise<MusicTrack[] | null> {
  try {
    return await fetchManifest(LIBRARY_MANIFEST_URL, fetchImpl, signal);
  } catch {
    // The API is optional (static hosting, server down): the static manifest is the fallback, quietly.
  }
  try {
    return await fetchManifest(`${base}manifest.json`, fetchImpl, signal);
  } catch (error) {
    if (!signal?.aborted) console.warn('Music library unavailable, using the bundled loop', error);
    return null;
  }
}
