import { describe, expect, it } from 'vitest';
import { LINE_PAUSE_SECONDS, buildVoiceTimeline, lineOfWord, voiceWordAt } from './sutra-voice-timeline';

const LINES = [
  { words: 4, seconds: 2.4, speech: 2 },
  { words: 2, seconds: 1.4, speech: 1 },
  { words: 3, seconds: 2, speech: 1.5 },
];

describe('buildVoiceTimeline', () => {
  it('places the lines back to back with a pause after each', () => {
    const timeline = buildVoiceTimeline(LINES, 0, 10);
    expect(timeline.entries.map((e) => [e.line, e.firstWord])).toEqual([
      [0, 0],
      [1, 4],
      [2, 6],
    ]);
    const starts = timeline.entries.map((e) => e.start);
    [10, 10 + 2.4 + LINE_PAUSE_SECONDS, 10 + 2.4 + 1.4 + 2 * LINE_PAUSE_SECONDS].forEach((want, i) => expect(starts[i]).toBeCloseTo(want));
    expect(timeline.entries[0]?.speechEnd).toBe(12);
    expect(timeline.end).toBeCloseTo(10 + 2.4 + 1.4 + 2 + 2 * LINE_PAUSE_SECONDS);
    expect(timeline.totalWords).toBe(9);
  });

  it('starts at a later line and counts the earlier ones as read', () => {
    const timeline = buildVoiceTimeline(LINES, 1, 0);
    expect(timeline.entries.map((e) => e.line)).toEqual([1, 2]);
    expect(timeline.fromWord).toBe(4);
    expect(timeline.entries[0]?.start).toBe(0);
  });

  it('clamps the starting line and gives broken clip lengths a length from the syllables', () => {
    expect(buildVoiceTimeline(LINES, -3, 0).entries[0]?.line).toBe(0);
    const past = buildVoiceTimeline(LINES, 99, 5);
    expect(past.entries).toEqual([]);
    expect(past.fromWord).toBe(9);
    expect(past.end).toBe(5);
    const broken = buildVoiceTimeline([{ words: 5, seconds: Number.NaN, speech: 9 }], 0, 0, 0);
    expect(broken.entries[0]?.next).toBe(2);
    expect(broken.entries[0]?.speechEnd).toBe(2);
  });
});

describe('voiceWordAt', () => {
  const timeline = buildVoiceTimeline(LINES, 0, 10);

  it('holds the first word before the voice starts', () => {
    expect(voiceWordAt(timeline, 0)).toBe(0);
    expect(voiceWordAt(buildVoiceTimeline(LINES, 2, 10), 9)).toBe(6);
  });

  it('shares a line evenly between its syllables while it is spoken', () => {
    expect(voiceWordAt(timeline, 10)).toBe(0);
    expect(voiceWordAt(timeline, 10.49)).toBe(0);
    expect(voiceWordAt(timeline, 10.5)).toBe(1);
    expect(voiceWordAt(timeline, 11.99)).toBe(3);
  });

  it('counts the whole line as read once its speech ends, through the echo and the pause', () => {
    expect(voiceWordAt(timeline, 12)).toBe(4);
    expect(voiceWordAt(timeline, 12.8)).toBe(4);
    const second = timeline.entries[1];
    expect(second && voiceWordAt(timeline, second.start + 0.6)).toBe(5);
  });

  it('reads every word after the last line', () => {
    expect(voiceWordAt(timeline, timeline.end)).toBe(9);
    expect(voiceWordAt(timeline, 999)).toBe(9);
  });

  it('never goes backwards as time moves on', () => {
    let last = -1;
    for (let t = 9; t < timeline.end + 1; t += 0.01) {
      const word = voiceWordAt(timeline, t);
      expect(word).toBeGreaterThanOrEqual(last);
      last = word;
    }
    expect(last).toBe(9);
  });
});

describe('lineOfWord', () => {
  it('finds the line holding a word, the last line past the end', () => {
    const words = [4, 2, 3];
    expect(lineOfWord(words, 0)).toBe(0);
    expect(lineOfWord(words, 3)).toBe(0);
    expect(lineOfWord(words, 4)).toBe(1);
    expect(lineOfWord(words, 8)).toBe(2);
    expect(lineOfWord(words, 9)).toBe(2);
    expect(lineOfWord([], 0)).toBe(0);
  });
});
