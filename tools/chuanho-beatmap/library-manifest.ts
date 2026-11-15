/**
 * The music library's manifest.json (written by tools/chuanho-music/qc_music.py in the workspace repo), read with
 * the same rules as the game's client (apps/web/src/audio/music-manifest.ts): a safe id, a plain file name. Bad
 * entries are reported and skipped, never followed outside the library directory.
 */

export interface LibraryTrack {
  readonly id: string;
  readonly file: string;
}

const SAFE_FILE = /^[a-z0-9][a-z0-9._-]{0,80}\.(mp3|m4a|ogg|webm)$/i;
const SAFE_ID = /^[a-z0-9_-]{1,40}$/i;

export interface ParsedLibrary {
  readonly tracks: readonly LibraryTrack[];
  /** One line per skipped entry. */
  readonly skipped: readonly string[];
}

/** The usable, de-duplicated tracks of a manifest; throws when it is not a manifest at all. */
export function parseLibraryManifest(raw: unknown): ParsedLibrary {
  const list = typeof raw === 'object' && raw !== null ? (raw as { tracks?: unknown }).tracks : undefined;
  if (!Array.isArray(list)) throw new Error('manifest.json has no "tracks" array');
  const tracks: LibraryTrack[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  list.forEach((entry: unknown, index) => {
    const { id, file } = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    if (typeof id !== 'string' || !SAFE_ID.test(id) || typeof file !== 'string' || !SAFE_FILE.test(file)) {
      skipped.push(`entry ${index}: bad id or file name`);
    } else if (seen.has(id)) {
      skipped.push(`entry ${index}: duplicate id ${id}`);
    } else {
      seen.add(id);
      tracks.push({ id, file });
    }
  });
  return { tracks, skipped };
}
