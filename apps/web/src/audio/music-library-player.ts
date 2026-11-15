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
 * - The radio steers the session (music-session.ts): skip, pause, preferred tags; a pause holds even when the
 *   context resumes, and picks keep the no-repeat promise whatever is preferred.
 * - Each track heard long enough is reported once per session to the library's listen count (music-listen-report.ts).
 * Screens ask for music through background-music.ts, which shares one session between them.
 */
import { type BackingTrack, startBackingTrack } from './backing-track';
import { type MusicDeck, fadeDeck as fade } from './music-decks';
import { createListenReporter } from './music-listen-report';
import { MUSIC_BASE, type MusicTrack, loadMusicManifest } from './music-manifest';
import { MIN_REPEAT_GAP_S, pickNextTrack } from './music-play-history';
import type { Session } from './music-session';
import { createStoredPlayHistory } from './stored-play-history';
import { createTimerSet } from './timer-set';

const CROSSFADE_S = 4;
const MAX_FAILURES_IN_A_ROW = 3;
export const FALLBACK_BPM = 68;
/** A timeupdate gap larger than this is a seek or a stall, not listening. */
const MAX_TICK_S = 2;

/** Number of library sessions playing (a stopping session pauses its decks only if no other took them over). */
let liveSessions = 0;

export function startLibrarySession(ctx: AudioContext, decks: readonly [MusicDeck, MusicDeck]): Session {
  const listeners = new AbortController();
  liveSessions += 1;
  let stopped = false;
  let fallback: BackingTrack | null = null;
  let tracks: MusicTrack[] = [];
  const history = createStoredPlayHistory();
  let current: MusicDeck | null = null;
  let currentTrack: MusicTrack | null = null;
  let upcoming: MusicTrack | null = null;
  let handedOver = false;
  let lastTime = 0;
  let failures = 0;
  let paused = false;
  let preferredTags: ReadonlySet<string> = new Set();
  let switchedAt = -Infinity;
  let tracksStarted = 0;
  let listenedS = 0;
  /** Seconds of the current track heard (seeks and stalls excluded), for the listen report. */
  let trackHeardS = 0;
  const listenReports = createListenReporter();
  const timers = createTimerSet();
  const later = timers.later;
  const pick = (): MusicTrack | null =>
    pickNextTrack(tracks, history.current(), Math.random, MIN_REPEAT_GAP_S, (track) => track.tags.some((tag) => preferredTags.has(tag)));
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
    upcoming = pick();
    const deck = other(current);
    if (!upcoming || deck.element.dataset.trackId === upcoming.id) return;
    deck.element.src = MUSIC_BASE + upcoming.file;
    deck.element.dataset.trackId = upcoming.id;
    deck.element.load();
  }

  function playNext(): void {
    if (stopped || fallback) return;
    const track = upcoming ?? pick();
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
    trackHeardS = 0;
    deck.element.currentTime = 0;
    tracksStarted += 1;
    switchedAt = performance.now();
    history.started(track.id);
    if (previous) {
      fade(previous, 0, CROSSFADE_S);
      later(() => {
        if (previous !== current) previous.element.pause();
        preloadNext();
      }, CROSSFADE_S * 1000 + 200);
    } else {
      later(preloadNext, 1000);
    }
    // Not now: the statechange listener (or the end of the pause) starts it.
    if (ctx.state !== 'running' || paused) return;
    playDeck(deck, previous ? CROSSFADE_S : 1.5);
  }

  function playDeck(deck: MusicDeck, fadeInS: number): void {
    deck.element.play().then(
      () => fade(deck, 1, fadeInS),
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
        listenedS += delta;
        history.listened(delta);
        trackHeardS += delta;
        if (currentTrack) listenReports.heard(currentTrack, trackHeardS);
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
        if (!paused) playDeck(current, 1);
      } else {
        for (const deck of decks) deck.element.pause();
      }
    },
    { signal: listeners.signal },
  );
  window.addEventListener('pagehide', history.save, { signal: listeners.signal });

  const manifestRequest = new AbortController();
  void loadMusicManifest(MUSIC_BASE, manifestRequest.signal).then((loaded) => {
    if (stopped) return;
    if (!loaded) return switchToFallback();
    tracks = loaded;
    history.load(new Set(loaded.map((t) => t.id)));
    playNext();
  });

  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      liveSessions -= 1;
      manifestRequest.abort();
      listeners.abort();
      timers.clear();
      if (tracks.length > 0) history.save();
      fallback?.stop();
      for (const deck of decks) fade(deck, 0, 0.6);
      // Pause after the fade, unless a new session has taken the decks over in the meantime.
      window.setTimeout(() => {
        if (liveSessions > 0) return;
        for (const deck of decks) deck.element.pause();
      }, 700);
    },
    skip(): void {
      // A skip during a crossfade would cut the track still fading out; one switch at a time.
      if (stopped || fallback || !current || performance.now() - switchedAt < CROSSFADE_S * 1000) return;
      handedOver = true;
      playNext();
    },
    setPaused(next: boolean): void {
      if (stopped || next === paused) return;
      paused = next;
      if (fallback || !current) return;
      if (paused) {
        fade(current, 0, 0.4);
        later(() => {
          if (paused) for (const deck of decks) deck.element.pause();
        }, 450);
        history.save();
      } else if (ctx.state === 'running') {
        playDeck(current, 1);
      }
    },
    setPreferredTags(tags: readonly string[]): void {
      preferredTags = new Set(tags);
      // Re-pick the preloaded next track when it no longer fits, unless its deck is still fading the last one out.
      const fits = !upcoming || preferredTags.size === 0 || upcoming.tags.some((tag) => preferredTags.has(tag));
      if (!fits && performance.now() - switchedAt > CROSSFADE_S * 1000 + 200) preloadNext();
    },
    stats: () => ({ tracksStarted, listenedS }),
  };
}
