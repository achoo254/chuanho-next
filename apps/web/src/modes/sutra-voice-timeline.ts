/**
 * Pure timing of the chanting voice-over: lays the per-line clips end to end on the audio clock (a short pause after
 * each) and tells which word the voice is on at any moment. There are no per-word timestamps from the voice model, so
 * a line's spoken part is shared evenly between its syllables (every word on screen is one syllable).
 */

/** What the timeline needs to know about one line on screen. */
export interface VoiceLineInput {
  /** Words (syllables) of the line. */
  readonly words: number;
  /** Length of the clip, echo tail included (seconds). */
  readonly seconds: number;
  /** The spoken part at the start of the clip (seconds), at most `seconds`. */
  readonly speech: number;
}

/** One line placed on the audio clock. */
export interface VoiceTimelineEntry {
  readonly line: number;
  /** Global index of the line's first word. */
  readonly firstWord: number;
  readonly words: number;
  /** Clip start, end of speech, and the moment the next line may start (clip end plus the pause), in context time. */
  readonly start: number;
  readonly speechEnd: number;
  readonly next: number;
}

export interface VoiceTimeline {
  readonly entries: readonly VoiceTimelineEntry[];
  /** Global index of the first word the timeline reads (the lines before it count as already read). */
  readonly fromWord: number;
  /** Word count of every line, the skipped ones included: the value of a finished reading. */
  readonly totalWords: number;
  /** When the last clip has finished ringing (context time). */
  readonly end: number;
}

/** Pause between two lines, on top of each clip's own echo tail. */
export const LINE_PAUSE_SECONDS = 0.45;

/**
 * Places lines `fromLine`.. on the clock from context time `startAt`. Lines with a broken clip length are given a
 * length from their syllable count so a bad manifest entry slows nothing down to zero or forever.
 */
export function buildVoiceTimeline(lines: readonly VoiceLineInput[], fromLine: number, startAt: number, pause = LINE_PAUSE_SECONDS): VoiceTimeline {
  const firstLine = Math.min(Math.max(0, Math.floor(fromLine)), lines.length);
  const entries: VoiceTimelineEntry[] = [];
  let firstWord = 0;
  let at = startAt;
  lines.forEach((line, index) => {
    if (index >= firstLine) {
      const fallback = Math.max(0.6, line.words * 0.4);
      const seconds = Number.isFinite(line.seconds) && line.seconds > 0 ? line.seconds : fallback;
      const speech = Number.isFinite(line.speech) && line.speech > 0 ? Math.min(line.speech, seconds) : seconds;
      entries.push({ line: index, firstWord, words: line.words, start: at, speechEnd: at + speech, next: at + seconds + pause });
      at += seconds + pause;
    }
    firstWord += line.words;
  });
  const fromWord = entries[0]?.firstWord ?? firstWord;
  return { entries, fromWord, totalWords: firstWord, end: entries.length > 0 ? at - pause : startAt };
}

/**
 * The word the voice is on at context time `time`, as the count of words already read: words with a lower index are
 * lit, the word at this index is the current one. Before the start it is the timeline's first word; once a line's
 * speech is over the whole line counts as read, so after the last line every word is read.
 */
export function voiceWordAt(timeline: VoiceTimeline, time: number): number {
  let read = timeline.fromWord;
  for (const entry of timeline.entries) {
    if (time < entry.start) return read;
    if (time >= entry.speechEnd) {
      read = entry.firstWord + entry.words;
      continue;
    }
    const share = (time - entry.start) / Math.max(1e-6, entry.speechEnd - entry.start);
    return entry.firstWord + Math.min(entry.words - 1, Math.floor(share * entry.words));
  }
  return read;
}

/** Index of the line holding global word `word` (the last line when `word` is past the end). */
export function lineOfWord(lineWords: readonly number[], word: number): number {
  let first = 0;
  for (let line = 0; line < lineWords.length; line += 1) {
    first += lineWords[line] ?? 0;
    if (word < first) return line;
  }
  return Math.max(0, lineWords.length - 1);
}
