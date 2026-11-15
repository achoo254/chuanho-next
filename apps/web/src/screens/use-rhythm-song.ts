/**
 * Runs one rhythm song: starts the synthesized backing track on the audio clock, judges taps in song time (the time
 * the player actually heard, output latency included), expires notes that slipped past, and ends the song.
 * The judge state lives in a ref (the source of truth for taps) mirrored into React state for the HUD.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { audioEngine, heardContextTime } from '../audio/audio-engine';
import { type LofiPad, startLofiPad } from '../audio/lofi-pad-synth';
import type { BeatChart } from '../game/beat-pattern';
import { type RhythmState, type TapOutcome, applyTap, expireMissedNotes, initialRhythmState } from '../game/rhythm-judge';

/** Silence before the count-in bar, so the first beat is never clipped. */
const LEAD_IN_S = 0.4;

export type SongPhase = 'idle' | 'playing' | 'finished';

export interface RhythmSong {
  readonly phase: SongPhase;
  readonly state: RhythmState;
  /** Current song time in ms (negative during the lead-in), or null when no song runs. */
  songTimeMs(): number | null;
  start(): void;
  stop(): void;
  /** Judges a tap at `eventTimeMs` (performance.now() time base). */
  tap(eventTimeMs: number): TapOutcome | null;
}

export function useRhythmSong(chart: BeatChart, onFinish: (state: RhythmState) => void): RhythmSong {
  const [phase, setPhase] = useState<SongPhase>('idle');
  const [state, setState] = useState<RhythmState>(() => initialRhythmState(chart.notes.length));
  const judge = useRef(state);
  const clock = useRef<((perfMs: number) => number) | null>(null);
  const pad = useRef<LofiPad | null>(null);
  const frame = useRef(0);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const songTimeMs = useCallback((): number | null => clock.current?.(performance.now()) ?? null, []);

  const halt = useCallback((): void => {
    cancelAnimationFrame(frame.current);
    pad.current?.stop();
    pad.current = null;
    clock.current = null;
  }, []);

  const start = useCallback((): void => {
    halt();
    const fresh = initialRhythmState(chart.notes.length);
    judge.current = fresh;
    setState(fresh);

    const engine = audioEngine();
    if (engine) {
      const startAt = engine.ctx.currentTime + LEAD_IN_S;
      clock.current = (perfMs) => ((heardContextTime(perfMs) ?? engine.ctx.currentTime) - startAt) * 1000;
      pad.current = startLofiPad({ bpm: chart.bpm, startAt, pulse: true, endAt: startAt + chart.durationMs / 1000 });
    } else {
      // No WebAudio: the song runs silently on the page clock so the mode still plays.
      const startPerf = performance.now() + LEAD_IN_S * 1000;
      clock.current = (perfMs) => perfMs - startPerf;
    }
    setPhase('playing');

    const loop = (): void => {
      const now = songTimeMs();
      if (now === null) return;
      const next = expireMissedNotes(judge.current, chart.notes, now);
      if (next !== judge.current) {
        judge.current = next;
        setState(next);
      }
      if (now >= chart.durationMs) {
        halt();
        setPhase('finished');
        onFinishRef.current(judge.current);
        return;
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, [chart, halt, songTimeMs]);

  const tap = useCallback(
    (eventTimeMs: number): TapOutcome | null => {
      const now = clock.current?.(eventTimeMs);
      if (now === undefined) return null;
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

  // Leaving the screen mid-song stops the music.
  useEffect(() => halt, [halt]);

  return { phase, state, songTimeMs, start, stop, tap };
}
