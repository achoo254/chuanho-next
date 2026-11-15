/**
 * Reads tools/chuanho-voice/asr-check.py output: one JSON line per clip
 * `{"file", "expected", "heard", "syllable_accuracy"}`. The factory runs it with `--min 0` and applies its own bar.
 */

export interface AsrScore {
  readonly file: string;
  readonly heard: string;
  readonly accuracy: number;
}

/** Same bar as asr-check.py's default `--min`. */
export const MIN_ASR_ACCURACY = 0.8;

export function parseAsrOutput(stdout: string): AsrScore[] {
  const scores: AsrScore[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith('{')) continue;
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      if (typeof row.file === 'string' && typeof row.syllable_accuracy === 'number') {
        scores.push({ file: row.file, heard: typeof row.heard === 'string' ? row.heard : '', accuracy: row.syllable_accuracy });
      }
    } catch {
      // a log line that happens to start with a brace
    }
  }
  return scores;
}

/** Best take per clip: highest accuracy, ties go to the earlier take. */
export function bestTake(scores: readonly AsrScore[], takes: readonly string[]): AsrScore | undefined {
  let best: AsrScore | undefined;
  for (const take of takes) {
    const score = scores.find((s) => s.file === take);
    if (score && (!best || score.accuracy > best.accuracy)) best = score;
  }
  return best;
}
