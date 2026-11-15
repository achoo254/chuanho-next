/**
 * Drives the chanting mode from the AI voice-over: while the voice can play (switched on, sound started and not
 * muted, tab visible, clips loaded), it reads from the line holding the current word and reports each word it reaches,
 * so the highlight follows the voice. When it cannot (mute, hidden tab, failed load), it stops cleanly and the mode
 * falls back to one word per strike; when it can again, it picks up at the line the player has reached.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine } from '../audio/audio-engine';
import { SUTRA_LINES } from '../game/sutra-text';
import { type SutraVoice, loadSutraVoice, startSutraVoice } from './sutra-voice-player';
import { lineOfWord, voiceWordAt } from './sutra-voice-timeline';

/** `idle`: not playing now (off, waiting for sound, muted, hidden, or finished). `unavailable`: the clips failed to load. */
export type SutraVoiceStatus = 'idle' | 'loading' | 'playing' | 'unavailable';

export interface SutraVoiceOptions {
  readonly enabled: boolean;
  /** The word the player has reached (count of words read); reading resumes from its line. */
  readonly word: number;
  readonly done: boolean;
  /** Called with the count of words read each time the voice reaches a new word. */
  onWord(word: number): void;
}

export interface SutraVoiceControl {
  readonly status: SutraVoiceStatus;
  /** Re-checks whether the voice can start (call from a tap: the first tap is what starts sound). */
  poke(): void;
}

const LINE_WORDS = SUTRA_LINES.map((line) => line.words.length);

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const update = (): void => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/** Whether the shared AudioContext exists and is running (the HUD's mute suspends it). */
function useAudioRunning(poked: number): boolean {
  const ctx = audioEngine()?.ctx;
  const [running, setRunning] = useState(() => ctx?.state === 'running');
  useEffect(() => {
    if (!ctx) return;
    const update = (): void => setRunning(ctx.state === 'running');
    update();
    ctx.addEventListener('statechange', update);
    return () => ctx.removeEventListener('statechange', update);
  }, [ctx, poked]);
  return running;
}

export function useSutraVoice({ enabled, word, done, onWord }: SutraVoiceOptions): SutraVoiceControl {
  const [poked, setPoked] = useState(0);
  const [voice, setVoice] = useState<SutraVoice | null>(null);
  const [failed, setFailed] = useState(false);
  const visible = useDocumentVisible();
  const running = useAudioRunning(poked);
  const wordRef = useRef(word);
  const onWordRef = useRef(onWord);
  useEffect(() => {
    wordRef.current = word;
    onWordRef.current = onWord;
  }, [word, onWord]);

  // Load the clips the first time the voice is wanted and sound is on; a failure leaves the mode silent.
  const wanted = enabled && !done && running && !failed;
  useEffect(() => {
    const engine = audioEngine();
    if (!wanted || voice || !engine) return;
    let cancelled = false;
    void loadSutraVoice(engine.ctx).then((loaded) => {
      if (cancelled) return;
      if (loaded) setVoice(loaded);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, voice]);

  // Read while everything allows it; any change of conditions stops the voice and its frame loop. Reaching the last
  // word makes the mode `done`, which ends the reading the same way.
  const playing = wanted && visible && voice !== null;
  useEffect(() => {
    const engine = audioEngine();
    if (!playing || !engine || !voice) return;
    const playback = startSutraVoice(engine, voice, lineOfWord(LINE_WORDS, wordRef.current));
    let frame = 0;
    let last = -1;
    const follow = (): void => {
      const reached = voiceWordAt(playback.timeline, engine.ctx.currentTime);
      if (reached !== last) {
        last = reached;
        onWordRef.current(reached);
      }
      if (reached < playback.timeline.totalWords) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => {
      cancelAnimationFrame(frame);
      playback.stop();
    };
  }, [playing, voice]);

  const poke = useCallback((): void => setPoked((n) => n + 1), []);
  const status: SutraVoiceStatus = failed ? 'unavailable' : playing ? 'playing' : wanted && !voice ? 'loading' : 'idle';
  return { status, poke };
}
