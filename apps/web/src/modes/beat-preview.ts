/**
 * A Mõ Beat song held still at one moment (`?play=beat&song=<ms>`), for screenshots: the clock stops there and every
 * note before it counts as hit on time, so the orbs in flight, the combo and the battery all look like real play.
 * No sound, no saved progress.
 */
import { useMemo } from 'react';
import type { BeatChart } from '../game/beat-pattern';
import { type RhythmState, applyTap, initialRhythmState } from '../game/rhythm-judge';

export interface BeatPreview {
  readonly phase: 'playing';
  readonly state: RhythmState;
  songTimeMs(): number;
}

/** The judge's state after hitting every note before `songMs` exactly on time. */
export function previewRhythmState(notes: readonly number[], songMs: number): RhythmState {
  let state = initialRhythmState(notes.length);
  for (const note of notes) {
    if (note >= songMs) break;
    state = applyTap(state, notes, note).state;
  }
  return state;
}

export function useBeatPreview(chart: BeatChart, songMs: number | null): BeatPreview | null {
  return useMemo(() => {
    if (songMs === null) return null;
    const state = previewRhythmState(chart.notes, songMs);
    return { phase: 'playing', state, songTimeMs: () => songMs };
  }, [chart, songMs]);
}
