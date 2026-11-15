/**
 * The music play history kept in localStorage (music-play-history.ts holds the pure rules): loaded once the library
 * is known, saved when a track starts, every few seconds of listening, and when the page hides or the music stops,
 * so a reload does not replay what was just heard.
 */
import { readStored, writeStored } from '../game/safe-storage';
import { EMPTY_HISTORY, type PlayHistory, addListened, markStarted, parsePlayHistory, pruneHistory } from './music-play-history';

const HISTORY_KEY = 'chuanho.music-history.v1';
const SAVE_EVERY_S = 15;

export interface StoredPlayHistory {
  current(): PlayHistory;
  /** Reads the stored history, forgetting tracks no longer in the library. */
  load(libraryIds: ReadonlySet<string>): void;
  started(id: string): void;
  listened(seconds: number): void;
  save(): void;
}

export function createStoredPlayHistory(): StoredPlayHistory {
  let history: PlayHistory = EMPTY_HISTORY;
  let unsaved = 0;
  const save = (): void => {
    unsaved = 0;
    writeStored(HISTORY_KEY, history);
  };
  return {
    current: () => history,
    load: (libraryIds) => {
      history = pruneHistory(readStored(HISTORY_KEY, parsePlayHistory) ?? EMPTY_HISTORY, libraryIds);
    },
    started: (id) => {
      history = markStarted(history, id);
      save();
    },
    listened: (seconds) => {
      history = addListened(history, seconds);
      unsaved += seconds;
      if (unsaved >= SAVE_EVERY_S) save();
    },
    save,
  };
}
