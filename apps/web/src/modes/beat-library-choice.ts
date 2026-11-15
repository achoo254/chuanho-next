/**
 * Which library track Mõ Beat offers next: the playable tracks (audio/beatmap-library.ts), a random one not played
 * recently (the recent list kept in localStorage), its beatmap fetched as soon as it is picked so a start does not
 * wait for it. A track whose beatmap fails is skipped for this visit; a track that cannot play (`drop`) too.
 */
import { useCallback, useEffect, useState } from 'react';
import { type BeatLibraryTrack, type LibraryBeatmap, loadBeatLibrary, loadLibraryBeatmap } from '../audio/beatmap-library';
import { MUSIC_BASE } from '../audio/music-manifest';
import { parseRecentTracks, pickLibraryTrack, rememberPlayed } from '../game/beat-library-song';
import { readStored, writeStored } from '../game/safe-storage';

const RECENT_KEY = 'chuanho.beat-recent.v1';

export interface BeatLibrarySong {
  readonly trackId: string;
  readonly src: string;
  readonly durationMs: number;
  readonly beatmap: LibraryBeatmap;
}

export interface BeatLibraryChoice {
  /** The picked song, ready to play; null while loading or when the library has none. */
  readonly song: BeatLibrarySong | null;
  /** Records that the current song was played, and picks another for the next start. */
  markPlayed(): void;
  /** Leaves the current track out for this visit (it could not play) and picks another. */
  drop(): void;
}

export function useBeatLibraryChoice(enabled: boolean): BeatLibraryChoice {
  const [catalog, setCatalog] = useState<readonly BeatLibraryTrack[]>([]);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [round, setRound] = useState(0);
  const [song, setSong] = useState<BeatLibrarySong | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadBeatLibrary().then((loaded) => {
      if (live) setCatalog(loaded);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  // Pick a track (again after each played or dropped one) and fetch its beatmap.
  useEffect(() => {
    let live = true;
    const pick = async (): Promise<void> => {
      const candidates = catalog.filter((entry) => !skipped.has(entry.track.id));
      const id = pickLibraryTrack(
        candidates.map((entry) => entry.track.id),
        readStored(RECENT_KEY, parseRecentTracks) ?? [],
      );
      const entry = candidates.find((candidate) => candidate.track.id === id);
      const beatmap = entry ? await loadLibraryBeatmap(entry.track.id) : null;
      if (!live) return;
      if (entry && beatmap) setSong({ trackId: entry.track.id, src: MUSIC_BASE + entry.track.file, durationMs: entry.durationMs, beatmap });
      else setSong(null);
      if (entry && !beatmap) setSkipped((previous) => new Set(previous).add(entry.track.id));
    };
    void pick();
    return () => {
      live = false;
    };
  }, [catalog, skipped, round]);

  const markPlayed = useCallback((): void => {
    if (!song) return;
    writeStored(RECENT_KEY, rememberPlayed(readStored(RECENT_KEY, parseRecentTracks) ?? [], song.trackId));
    setRound((n) => n + 1);
  }, [song]);

  const drop = useCallback((): void => {
    if (!song) return;
    const { trackId } = song;
    setSong(null);
    setSkipped((previous) => new Set(previous).add(trackId));
  }, [song]);

  return { song, markPlayed, drop };
}
