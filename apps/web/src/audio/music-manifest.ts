/**
 * The music library's manifest, served next to the tracks at /media/music/manifest.json (kept on the server, not in
 * the release: see docs/deployment-guide.md). Validated here because it comes over the network: entries with a
 * bad shape or an unsafe file name are dropped, never trusted.
 */

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

const SAFE_FILE = /^[a-z0-9][a-z0-9._-]{0,80}\.(mp3|m4a|ogg|webm)$/i;
const SAFE_ID = /^[a-z0-9_-]{1,40}$/i;

function parseTrack(raw: unknown): MusicTrack | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, file, duration, tags } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || !SAFE_ID.test(id)) return null;
  if (typeof file !== 'string' || !SAFE_FILE.test(file)) return null;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 10 || duration > 1800) return null;
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

/** Fetches and validates the manifest; null when offline, missing (the SPA fallback answers HTML) or empty. */
export async function loadMusicManifest(base: string = MUSIC_BASE, signal?: AbortSignal): Promise<MusicTrack[] | null> {
  try {
    const response = await fetch(`${base}manifest.json`, { cache: 'no-cache', signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // A missing manifest may come back as the SPA's index.html (status 200): json() then throws, which is the check.
    const tracks = parseMusicManifest(await response.json());
    return tracks && tracks.length > 0 ? tracks : null;
  } catch (error) {
    if (!signal?.aborted) console.warn('Music library unavailable, using the bundled loop', error);
    return null;
  }
}
