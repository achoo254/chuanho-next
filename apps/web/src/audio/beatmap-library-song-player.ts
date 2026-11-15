/**
 * Runs one Mõ Beat song on a music-library track: the same judging loop as use-rhythm-song.ts (taps judged in the
 * song time the player heard, missed notes expired, the song ended), but the music is the track itself, streamed
 * through a media element wired into the music bus like the library's decks (music-decks.ts), and the note clock
 * follows that audio: song time is the element's playback position, carried between its coarse updates by the
 * audio context's clock and re-anchored whenever the two part (a stall, a seek).
 *
 * Start, inside the tap: the element is unlocked there (muted play, then pause; iOS needs the gesture), the track is
 * preloaded to the point where it can play through, and only then does it play from its start, so the count-in is
 * never eaten by buffering. The background music pauses for the song and carries on after it. When the track
 * cannot play (no WebAudio, sound off, load error or timeout), `onUnavailable` fires and the caller falls back to
 * the synthesized song.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LibraryBeatChart } from '../game/beat-library-song';
import { type RhythmState, type TapOutcome, applyTap, expireMissedNotes, initialRhythmState } from '../game/rhythm-judge';
import { audioEngine, heardContextTime } from './audio-engine';
import { backgroundMusicControls } from './background-music';
import { type MusicDeck, fadeDeck } from './music-decks';
import type { RhythmSong, SongPhase } from './use-rhythm-song';

/** Longest wait for the track to be ready before giving up on it. */
const LOAD_TIMEOUT_MS = 12_000;
/** Media position and the context clock may disagree by this much before the clock re-anchors to the media. */
const RESYNC_MS = 45;
const FADE_IN_S = 0.3;
const STOP_FADE_S = 0.4;

export interface LibrarySong extends RhythmSong {
  /** True while the track loads after a start (the level card stays, its start button busy). */
  readonly loading: boolean;
}

/** One media element for library songs, wired into the music bus once (an element can be wired only once). */
let songDeck: MusicDeck | null = null;
/** Counts starts on the deck, so a stop's delayed pause never hits a song started after it. */
let deckGeneration = 0;

function librarySongDeck(ctx: AudioContext, bus: AudioNode): MusicDeck | null {
  if (songDeck) return songDeck;
  try {
    const element = new Audio();
    element.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(element).connect(gain).connect(bus);
    songDeck = { element, gain };
    return songDeck;
  } catch (error) {
    console.warn('Library song deck unavailable', error);
    return null;
  }
}

/** Resolves once the element can play through (or rejects on error / timeout / abort). */
function whenReady(element: HTMLAudioElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (element.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      resolve();
      return;
    }
    const done = new AbortController();
    const timer = window.setTimeout(() => finish(new Error('timed out loading the track')), LOAD_TIMEOUT_MS);
    function finish(error?: unknown): void {
      window.clearTimeout(timer);
      done.abort();
      if (error === undefined) resolve();
      else reject(error instanceof Error ? error : new Error(String(error)));
    }
    element.addEventListener('canplaythrough', () => finish(), { signal: done.signal });
    element.addEventListener('error', () => finish(new Error(element.error?.message || 'media error')), { signal: done.signal });
    signal.addEventListener('abort', () => finish(new Error('aborted')), { signal: done.signal });
  });
}

/**
 * `chart` and `src` describe the song a start will play (null: nothing to play, start reports unavailable).
 * `onUnavailable` runs when a start cannot play the track; nothing was judged, the phase is back to idle.
 * `trackFailed` tells a track that failed to load or play (worth leaving out) from audio being off or missing.
 */
export function useLibrarySong(
  chart: LibraryBeatChart | null,
  src: string | null,
  onFinish: (state: RhythmState) => void,
  onUnavailable: (trackFailed: boolean) => void,
): LibrarySong {
  const [phase, setPhase] = useState<SongPhase>('idle');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<RhythmState>(() => initialRhythmState(chart?.notes.length ?? 0));
  const judge = useRef(state);
  const clock = useRef<((perfMs: number) => number) | null>(null);
  const frame = useRef(0);
  const run = useRef<AbortController | null>(null);
  const backdropPaused = useRef(false);
  const callbacks = useRef({ onFinish, onUnavailable });
  useEffect(() => {
    callbacks.current = { onFinish, onUnavailable };
  }, [onFinish, onUnavailable]);

  const songTimeMs = useCallback((): number | null => clock.current?.(performance.now()) ?? null, []);

  const releaseBackdrop = useCallback((): void => {
    if (!backdropPaused.current) return;
    backdropPaused.current = false;
    backgroundMusicControls()?.setPaused(false);
  }, []);

  /** Stops the loop, the clock and the track (faded), and gives the background music back. */
  const halt = useCallback((): void => {
    cancelAnimationFrame(frame.current);
    run.current?.abort();
    run.current = null;
    clock.current = null;
    setLoading(false);
    const deck = songDeck;
    if (deck && !deck.element.paused) {
      fadeDeck(deck, 0, STOP_FADE_S);
      const generation = deckGeneration;
      window.setTimeout(() => {
        if (generation === deckGeneration) deck.element.pause();
      }, STOP_FADE_S * 1000 + 50);
    }
    releaseBackdrop();
  }, [releaseBackdrop]);

  const start = useCallback((): void => {
    halt();
    const engine = audioEngine();
    const deck = engine && engine.ctx.state === 'running' ? librarySongDeck(engine.ctx, engine.music) : null;
    if (!engine || !deck || !chart || !src) {
      callbacks.current.onUnavailable(false);
      return;
    }
    deckGeneration += 1;
    const song = chart;
    const fresh = initialRhythmState(song.notes.length);
    judge.current = fresh;
    setState(fresh);
    setLoading(true);
    const controller = new AbortController();
    run.current = controller;
    const { ctx } = engine;
    const { element } = deck;

    const fail = (error: unknown): void => {
      if (controller.signal.aborted) return;
      console.warn('Library song could not play, using the built-in song', error);
      halt();
      setPhase('idle');
      callbacks.current.onUnavailable(true);
    };

    // In the gesture: point the deck at the track and unlock it with a muted play.
    fadeDeck(deck, 0, 0.01);
    if (element.getAttribute('src') !== src) element.src = src;
    element.muted = true;
    const unlocked = element.play().then(
      () => element.pause(),
      (error: unknown) => console.warn('Library song deck could not be unlocked in the tap', error),
    );

    void unlocked
      .then(() => {
        element.muted = false;
        element.currentTime = 0;
        return whenReady(element, controller.signal);
      })
      .then(() => {
        if (controller.signal.aborted) return;
        backdropPaused.current = true;
        backgroundMusicControls()?.setPaused(true);
        return element.play();
      })
      .then(() => {
        if (controller.signal.aborted) return;
        fadeDeck(deck, 1, FADE_IN_S);
        // File time (ms) heard at context time `anchorCtx` (ms); song time = file time - origin.
        let anchorFile = element.currentTime * 1000;
        let anchorCtx = ctx.currentTime * 1000;
        clock.current = (perfMs) => anchorFile + ((heardContextTime(perfMs) ?? ctx.currentTime) * 1000 - anchorCtx) - song.audioOriginMs;
        let fading = false;
        setLoading(false);
        setPhase('playing');

        const loop = (): void => {
          if (controller.signal.aborted) return;
          const mediaMs = element.currentTime * 1000;
          const ctxMs = ctx.currentTime * 1000;
          if (Math.abs(mediaMs - (anchorFile + ctxMs - anchorCtx)) > RESYNC_MS) {
            anchorFile = mediaMs;
            anchorCtx = ctxMs;
          }
          const now = songTimeMs();
          if (now === null) return;
          const next = expireMissedNotes(judge.current, song.notes, now);
          if (next !== judge.current) {
            judge.current = next;
            setState(next);
          }
          if (!fading && now >= song.fadeFromMs) {
            fading = true;
            fadeDeck(deck, 0, Math.max(0.1, (song.durationMs - now) / 1000));
          }
          if (now >= song.durationMs || element.ended) {
            halt();
            setPhase('finished');
            callbacks.current.onFinish(judge.current);
            return;
          }
          frame.current = requestAnimationFrame(loop);
        };
        frame.current = requestAnimationFrame(loop);
      })
      .catch(fail);

    // A media error mid-song ends it quietly; the next start falls back to the built-in song.
    element.addEventListener('error', () => fail(new Error(element.error?.message || 'media error')), { signal: controller.signal });
  }, [chart, src, halt, songTimeMs]);

  const tap = useCallback(
    (eventTimeMs: number): TapOutcome | null => {
      const now = clock.current?.(eventTimeMs);
      if (now === undefined || !chart) return null;
      const result = applyTap(judge.current, chart.notes, now);
      judge.current = result.state;
      setState(result.state);
      return result.outcome;
    },
    [chart],
  );

  const stop = useCallback((): void => {
    halt();
    setPhase('idle');
  }, [halt]);

  // Leaving the screen mid-song stops the track and gives the background music back.
  useEffect(() => halt, [halt]);

  return { phase, state, loading, songTimeMs, start, stop, tap };
}
