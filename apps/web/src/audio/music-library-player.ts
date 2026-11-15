/**
 * Background music from the AI-made library on the server (/media/music/): endless, shuffled, with no track heard
 * twice within four hours of listening (music-play-history.ts), the history kept in localStorage so a reload does
 * not replay what was just heard. Tracks stream through two media elements wired into the music bus, the next one
 * preloaded and faded in over the last seconds of the current one.
 *
 * Decisions:
 * - A hidden tab keeps playing: leaving the yard running in the background (idle play, falling asleep) is a use case.
 * - When the AudioContext is suspended (the HUD's sound switch, or the browser), the decks pause, so muted time does
 *   not use up the library; they resume with the context.
 * - A track that fails to load is skipped; three failures in a row, or no manifest (offline, dev server), switch to
 *   the bundled pad loop until the music is next requested.
 * Screens ask for music through background-music.ts, which shares one session between them.
 */
import { readStored, writeStored } from '../game/safe-storage';
import { type BackingTrack, startBackingTrack } from './backing-track';
import type { MusicDeck } from './music-decks';
import { MUSIC_BASE, type MusicTrack, loadMusicManifest } from './music-manifest';
import { EMPTY_HISTORY, type PlayHistory, addListened, markStarted, parsePlayHistory, pickNextTrack, pruneHistory } from './music-play-history';

const HISTORY_KEY = 'chuanho.music-history.v1';
const CROSSFADE_S = 4;
const SAVE_EVERY_S = 15;
const MAX_FAILURES_IN_A_ROW = 3;
export const FALLBACK_BPM = 68;
/** A timeupdate gap larger than this is a seek or a stall, not listening. */
const MAX_TICK_S = 2;

export interface Session {
  stop(): void;
}

function fade(deck: MusicDeck, to: number, seconds: number): void {
  const { gain, context } = deck.gain;
  const now = context.currentTime;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(to, now + seconds);
}

/** Number of library sessions playing (a stopping session pauses its decks only if no other took them over). */
let liveSessions = 0;

export function startLibrarySession(ctx: AudioContext, decks: readonly [MusicDeck, MusicDeck]): Session {
  const listeners = new AbortController();
  liveSessions += 1;
  let stopped = false;
  let fallback: BackingTrack | null = null;
  let tracks: MusicTrack[] = [];
  let history: PlayHistory = EMPTY_HISTORY;
  let current: MusicDeck | null = null;
  let currentTrack: MusicTrack | null = null;
  let upcoming: MusicTrack | null = null;
  let handedOver = false;
  let lastTime = 0;
  let unsaved = 0;
  let failures = 0;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const save = (): void => {
    unsaved = 0;
    writeStored(HISTORY_KEY, history);
  };
  const other = (deck: MusicDeck | null): MusicDeck => (deck === decks[0] ? decks[1] : decks[0]);

  function switchToFallback(): void {
    if (stopped || fallback) return;
    for (const deck of decks) {
      fade(deck, 0, 0.5);
      later(() => deck.element.pause(), 600);
    }
    current = null;
    fallback = startBackingTrack({ bpm: FALLBACK_BPM, startAt: ctx.currentTime + 0.1, pulse: false });
  }

  function preloadNext(): void {
    if (stopped || !current) return;
    upcoming = pickNextTrack(tracks, history);
    const deck = other(current);
    if (!upcoming || deck.element.dataset.trackId === upcoming.id) return;
    deck.element.src = MUSIC_BASE + upcoming.file;
    deck.element.dataset.trackId = upcoming.id;
    deck.element.load();
  }

  function playNext(): void {
    if (stopped || fallback) return;
    const track = upcoming ?? pickNextTrack(tracks, history);
    upcoming = null;
    if (!track) return switchToFallback();
    const deck = other(current);
    if (deck.element.dataset.trackId !== track.id) {
      deck.element.src = MUSIC_BASE + track.file;
      deck.element.dataset.trackId = track.id;
    }
    const previous = current;
    current = deck;
    currentTrack = track;
    handedOver = false;
    lastTime = 0;
    deck.element.currentTime = 0;
    history = markStarted(history, track.id);
    save();
    if (previous) {
      fade(previous, 0, CROSSFADE_S);
      later(() => {
        if (previous !== current) previous.element.pause();
        preloadNext();
      }, CROSSFADE_S * 1000 + 200);
    } else {
      later(preloadNext, 1000);
    }
    if (ctx.state !== 'running') return; // the statechange listener starts it with the context
    deck.element.play().then(
      () => fade(deck, 1, previous ? CROSSFADE_S : 1.5),
      (error: unknown) => fail(deck, error),
    );
  }

  function fail(deck: MusicDeck, error: unknown): void {
    if (stopped || deck !== current) return;
    console.warn(`Music track ${currentTrack?.id ?? '?'} failed, skipping`, error);
    failures += 1;
    deck.element.removeAttribute('data-track-id');
    if (failures >= MAX_FAILURES_IN_A_ROW) switchToFallback();
    else playNext();
  }

  for (const deck of decks) {
    const { element } = deck;
    const on = (type: string, fn: () => void): void => element.addEventListener(type, fn, { signal: listeners.signal });
    on('timeupdate', () => {
      if (deck !== current || stopped) return;
      const delta = element.currentTime - lastTime;
      lastTime = element.currentTime;
      if (delta > 0 && delta <= MAX_TICK_S) {
        failures = 0;
        history = addListened(history, delta);
        unsaved += delta;
        if (unsaved >= SAVE_EVERY_S) save();
      }
      if (!handedOver && Number.isFinite(element.duration) && element.duration - element.currentTime <= CROSSFADE_S) {
        handedOver = true;
        playNext();
      }
    });
    on('ended', () => {
      if (deck === current && !handedOver) {
        handedOver = true;
        playNext();
      }
    });
    on('error', () => fail(deck, element.error));
  }

  // Pause with the context (sound switched off) and carry on where it was when it runs again.
  ctx.addEventListener(
    'statechange',
    () => {
      if (stopped || !current) return;
      if (ctx.state === 'running') {
        const deck = current;
        deck.element.play().then(
          () => fade(deck, 1, 1),
          (error: unknown) => fail(deck, error),
        );
      } else {
        for (const deck of decks) deck.element.pause();
      }
    },
    { signal: listeners.signal },
  );
  window.addEventListener('pagehide', save, { signal: listeners.signal });

  const manifestRequest = new AbortController();
  void loadMusicManifest(MUSIC_BASE, manifestRequest.signal).then((loaded) => {
    if (stopped) return;
    if (!loaded) return switchToFallback();
    tracks = loaded;
    history = pruneHistory(readStored(HISTORY_KEY, parsePlayHistory) ?? EMPTY_HISTORY, new Set(loaded.map((t) => t.id)));
    playNext();
  });

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      liveSessions -= 1;
      manifestRequest.abort();
      listeners.abort();
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      if (tracks.length > 0) save();
      fallback?.stop();
      for (const deck of decks) fade(deck, 0, 0.6);
      // Pause after the fade, unless a new session has taken the decks over in the meantime.
      window.setTimeout(() => {
        if (liveSessions > 0) return;
        for (const deck of decks) deck.element.pause();
      }, 700);
    },
  };
}
