import { describe, expect, it } from 'vitest';
import { generateBeatChart } from '../game/beat-pattern';
import { previewRhythmState } from './beat-preview';

describe('previewRhythmState', () => {
  it('counts every note before the moment as a perfect hit and leaves the rest pending', () => {
    const chart = generateBeatChart('normal');
    const at = chart.notes[6] ?? 0;
    const state = previewRhythmState(chart.notes, at);
    expect(state.perfects).toBe(6);
    expect(state.combo).toBe(6);
    expect(state.noteStates.slice(6).every((s) => s === 'pending')).toBe(true);
  });
});
