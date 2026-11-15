/**
 * Running score of one rhythm song: which notes are judged, the combo, the private score and the "peace battery".
 * Pure state transitions; the screen feeds it taps and the clock, and draws the result.
 */
import { GOOD_WINDOW_MS, MASH_WINDOW_MS, type TapGrade, gradeTap } from './grade-tap';

/** Battery (0–100) gained per grade. Mashing and misses gain nothing. */
const BATTERY_GAIN: Readonly<Record<TapGrade, number>> = { perfect: 4, good: 2, miss: 0 };
const SCORE_GAIN: Readonly<Record<TapGrade, number>> = { perfect: 300, good: 100, miss: 0 };
export const BATTERY_MAX = 100;

export type NoteState = 'pending' | TapGrade;

export interface RhythmState {
  readonly noteStates: readonly NoteState[];
  readonly combo: number;
  readonly bestCombo: number;
  readonly score: number;
  readonly battery: number;
  readonly perfects: number;
  readonly goods: number;
  readonly misses: number;
}

/** What one tap did, for the floating feedback text. */
export type TapOutcome = { readonly kind: 'graded'; readonly grade: TapGrade; readonly noteIndex: number } | { readonly kind: 'mash' };

export function initialRhythmState(noteCount: number): RhythmState {
  return {
    noteStates: Array.from({ length: noteCount }, (): NoteState => 'pending'),
    combo: 0,
    bestCombo: 0,
    score: 0,
    battery: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
  };
}

/** The pending note nearest to `timeMs` within the mash window, or -1. */
function nearestPendingNote(notes: readonly number[], states: readonly NoteState[], timeMs: number): number {
  let best = -1;
  let bestDistance = MASH_WINDOW_MS;
  notes.forEach((noteMs, index) => {
    if (states[index] !== 'pending') return;
    const distance = Math.abs(timeMs - noteMs);
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function withGrade(state: RhythmState, index: number, grade: TapGrade): RhythmState {
  const noteStates = state.noteStates.map((s, i) => (i === index ? grade : s));
  const hit = grade !== 'miss';
  const combo = hit ? state.combo + 1 : 0;
  // A longer combo is worth a little more, capped so one long streak cannot dwarf the rest.
  const comboBonus = hit ? Math.min(combo, 50) * 2 : 0;
  return {
    noteStates,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    score: state.score + SCORE_GAIN[grade] + comboBonus,
    battery: Math.min(BATTERY_MAX, state.battery + BATTERY_GAIN[grade]),
    perfects: state.perfects + (grade === 'perfect' ? 1 : 0),
    goods: state.goods + (grade === 'good' ? 1 : 0),
    misses: state.misses + (grade === 'miss' ? 1 : 0),
  };
}

/** A tap at `timeMs` (song time the player heard): grades the nearest note, or breaks the combo when mashing. */
export function applyTap(state: RhythmState, notes: readonly number[], timeMs: number): { state: RhythmState; outcome: TapOutcome } {
  const index = nearestPendingNote(notes, state.noteStates, timeMs);
  if (index < 0) return { state: { ...state, combo: 0 }, outcome: { kind: 'mash' } };
  const grade = gradeTap(timeMs - (notes[index] ?? Number.NaN));
  return { state: withGrade(state, index, grade), outcome: { kind: 'graded', grade, noteIndex: index } };
}

/** Marks every pending note whose GOOD window has passed by `timeMs` as missed. Returns the same object when nothing changed. */
export function expireMissedNotes(state: RhythmState, notes: readonly number[], timeMs: number): RhythmState {
  let next = state;
  notes.forEach((noteMs, index) => {
    if (next.noteStates[index] === 'pending' && timeMs - noteMs > GOOD_WINDOW_MS) next = withGrade(next, index, 'miss');
  });
  return next;
}

/** True once every note is judged. */
export function isSongJudged(state: RhythmState): boolean {
  return state.noteStates.every((s) => s !== 'pending');
}
