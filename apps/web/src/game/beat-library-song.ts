/**
 * A Mõ Beat song on a track of the music library: the track's generated beatmap (tools/chuanho-beatmap) turned into
 * the same `BeatChart` the synthesized song uses, so the judge, the orbs and the HUD need nothing new.
 *
 * Song time 0 is a downbeat of the track (the first downbeat folded back by whole bars to within the first bar), so
 * the beat pulse and the accent notes, which count beats from 0, fall on the music's own bars. The audio plays from
 * the file's start, which is song time `-audioOriginMs`; the first bar of music after song time 0 is the count-in.
 * Long tracks are cut after whole bars near SONG_CAP_MS and fade out; short ones play to their end.
 *
 * Pure: no audio, no DOM, deterministic given its inputs (the random source of the pick is passed in).
 */
import { BEATS_PER_BAR, type BeatChart, COUNT_IN_BARS, type Difficulty, OUTRO_BARS } from './beat-pattern';

/** A library song is about this long at most (whole bars). */
export const SONG_CAP_MS = 150_000;
/** The last stretch of every library song fades out (a cut track would otherwise stop dead). */
export const SONG_FADE_MS = 2_500;
/** Fewer notes than this is not worth a song; the synthesized one plays instead. */
const MIN_NOTES = 8;
/** Tracks remembered as "played recently", skipped by the next picks while others remain. */
export const RECENT_TRACKS = 5;

/** What a library song needs from a validated beatmap. */
export interface LibraryBeatmapInput {
  readonly bpm: number;
  /** File time (ms) of the first downbeat. */
  readonly offsetMs: number;
  /** Note times per level, ms from the start of the file, ascending. */
  readonly levels: Readonly<Record<Difficulty, readonly number[]>>;
}

export interface LibraryBeatChart extends BeatChart {
  /** File time (ms) at song time 0: the audio starts at song time `-audioOriginMs`. */
  readonly audioOriginMs: number;
  /** Song time (ms) when the fade-out starts; the song ends at `durationMs`. */
  readonly fadeFromMs: number;
}

/** The chart of one difficulty of a library track, or null when the beatmap cannot carry a song. */
export function buildLibraryChart(beatmap: LibraryBeatmapInput, difficulty: Difficulty, trackDurationMs: number): LibraryBeatChart | null {
  if (!(beatmap.bpm > 0) || !(trackDurationMs > 0) || !(beatmap.offsetMs >= 0)) return null;
  const beatMs = 60_000 / beatmap.bpm;
  const barMs = BEATS_PER_BAR * beatMs;
  const audioOriginMs = beatmap.offsetMs % barMs;
  const fileEndSongMs = trackDurationMs - audioOriginMs;

  // A track much longer than the cap is cut after whole bars, with a quiet bar before the end.
  const cut = fileEndSongMs > SONG_CAP_MS + barMs;
  const durationMs = cut ? Math.floor(SONG_CAP_MS / barMs) * barMs : fileEndSongMs;
  const lastNoteBefore = cut ? durationMs - OUTRO_BARS * barMs : durationMs - beatMs;
  const firstNoteFrom = COUNT_IN_BARS * barMs;

  const notes = beatmap.levels[difficulty].map((fileMs) => fileMs - audioOriginMs).filter((songMs) => songMs >= firstNoteFrom - 1e-6 && songMs < lastNoteBefore);
  if (notes.length < MIN_NOTES) return null;
  return {
    difficulty,
    bpm: beatmap.bpm,
    beatMs,
    durationMs,
    notes,
    audioOriginMs,
    fadeFromMs: Math.max(0, durationMs - SONG_FADE_MS),
  };
}

/** A random track id not among the recent ones (all of them when every track is recent), or null for none. */
export function pickLibraryTrack(ids: readonly string[], recent: readonly string[], random: () => number = Math.random): string | null {
  if (ids.length === 0) return null;
  const fresh = ids.filter((id) => !recent.includes(id));
  const pool = fresh.length > 0 ? fresh : ids;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] ?? null;
}

/** The recent list once `id` has been played: most recent first, at most RECENT_TRACKS long. */
export function rememberPlayed(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((other) => other !== id)].slice(0, RECENT_TRACKS);
}

/** A stored recent list if it has the right shape (short list of short strings), else null. */
export function parseRecentTracks(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 40).slice(0, RECENT_TRACKS);
}
