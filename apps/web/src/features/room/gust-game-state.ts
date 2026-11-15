/**
 * Running state of one "Hộ hương" round: which gusts are judged, the flame points left, the combo, the calm score and
 * how the round ends. Pure transitions like game/rhythm-judge.ts: the overlay feeds taps and the clock and draws the
 * events. Gentle by design: a low flame ends the round early with kind words, nothing real is lost.
 */
import { type GustGrade, type GustMark, expiredGusts, matchTap } from './gust-judge';
import type { Gust, GustSide } from './gust-schedule';

export const FLAME_POINTS = 5;
const SCORE_GAIN: Readonly<Record<Exclude<GustGrade, 'miss'>, number>> = { perfect: 100, good: 60 };
/** Bonus per combo step, capped so one long streak does not dwarf the rest. */
const COMBO_BONUS = 10;
const COMBO_BONUS_CAP = 10;

export type GustEnd = 'complete' | 'flameLow';

export interface GustGameState {
  readonly marks: readonly GustMark[];
  readonly flame: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly score: number;
  readonly perfects: number;
  readonly goods: number;
  readonly misses: number;
  /** Null while the round runs. */
  readonly ended: GustEnd | null;
}

/** What happened to one gust, for the sound, the 3D flame and the floating words. */
export type GustEvent =
  | { readonly kind: 'shield'; readonly index: number; readonly grade: Exclude<GustGrade, 'miss'>; readonly combo: number }
  | { readonly kind: 'miss'; readonly index: number; readonly reason: 'late' | 'wrong-side' };

export function initialGustGame(gustCount: number): GustGameState {
  return {
    marks: Array.from({ length: gustCount }, (): GustMark => 'pending'),
    flame: FLAME_POINTS,
    combo: 0,
    bestCombo: 0,
    score: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
    ended: gustCount === 0 ? 'complete' : null,
  };
}

/** The round ends when the flame is out of points or every gust is judged. */
function withEnd(state: GustGameState): GustGameState {
  if (state.ended) return state;
  if (state.flame <= 0) return { ...state, ended: 'flameLow' };
  if (state.marks.every((mark) => mark !== 'pending')) return { ...state, ended: 'complete' };
  return state;
}

function marked(marks: readonly GustMark[], index: number, mark: GustMark): readonly GustMark[] {
  return marks.map((current, i) => (i === index ? mark : current));
}

function shield(state: GustGameState, index: number, grade: Exclude<GustGrade, 'miss'>): GustGameState {
  const combo = state.combo + 1;
  return withEnd({
    ...state,
    marks: marked(state.marks, index, grade),
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    score: state.score + SCORE_GAIN[grade] + Math.min(combo, COMBO_BONUS_CAP) * COMBO_BONUS,
    perfects: state.perfects + (grade === 'perfect' ? 1 : 0),
    goods: state.goods + (grade === 'good' ? 1 : 0),
  });
}

function miss(state: GustGameState, index: number): GustGameState {
  return withEnd({ ...state, marks: marked(state.marks, index, 'miss'), combo: 0, flame: state.flame - 1, misses: state.misses + 1 });
}

/** A tap on `side` at round time `tapMs`. Taps with no gust coming do nothing; taps after the end are ignored. */
export function tapGust(state: GustGameState, gusts: readonly Gust[], side: GustSide, tapMs: number): { state: GustGameState; event: GustEvent | null } {
  if (state.ended) return { state, event: null };
  const match = matchTap(gusts, state.marks, side, tapMs);
  if (match.kind === 'shield') {
    const next = shield(state, match.index, match.grade);
    return { state: next, event: { kind: 'shield', index: match.index, grade: match.grade, combo: next.combo } };
  }
  if (match.kind === 'wrong-side') return { state: miss(state, match.index), event: { kind: 'miss', index: match.index, reason: 'wrong-side' } };
  return { state, event: null };
}

/** Lets through every gust nobody shielded by round time `nowMs`. Returns the same state object when nothing changed. */
export function advanceGusts(state: GustGameState, gusts: readonly Gust[], nowMs: number): { state: GustGameState; events: GustEvent[] } {
  if (state.ended) return { state, events: [] };
  let next = state;
  const events: GustEvent[] = [];
  for (const index of expiredGusts(gusts, state.marks, nowMs)) {
    if (next.ended) break;
    next = miss(next, index);
    events.push({ kind: 'miss', index, reason: 'late' });
  }
  return { state: next, events };
}

/** 1 to 3 stars: a full round with at most one miss earns three, at most three misses two; anything else one. */
export function starsFor(state: GustGameState): 1 | 2 | 3 {
  if (state.ended !== 'complete') return 1;
  if (state.misses <= 1) return 3;
  if (state.misses <= 3) return 2;
  return 1;
}
