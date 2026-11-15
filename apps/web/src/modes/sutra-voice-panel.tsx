/**
 * The chanting text as a small lower-third strip over the 3D scene: the line being read, word by word (read words
 * full ink, the current word in red and underlined), and the next line faded below it. Real HTML text, announced
 * line by line to screen readers; taps pass through to the wooden fish underneath.
 */
import type { ReactNode } from 'react';
import type { SutraLine } from '../game/sutra-text';
import type { SutraVoiceStatus } from './sutra-voice-hook';
import { lineOfWord } from './sutra-voice-timeline';
import './sutra-voice-panel.css';

interface SutraVoicePanelProps {
  readonly lines: readonly SutraLine[];
  /** Count of words read so far. */
  readonly lit: number;
  /** Accessible name of the strip (what the text is and where it comes from). */
  readonly label: string;
  readonly voiceStatus: SutraVoiceStatus;
}

export function SutraVoicePanel({ lines, lit, label, voiceStatus }: SutraVoicePanelProps): ReactNode {
  const lineWords = lines.map((line) => line.words.length);
  const current = lineOfWord(lineWords, lit);
  const firstWord = lineWords.slice(0, current).reduce((sum, n) => sum + n, 0);
  const line = lines[current];
  const next = lines[current + 1];
  if (!line) return null;
  return (
    <section className="sutra-panel" aria-label={label} data-id="sutra-paper" data-voice={voiceStatus} lang="vi">
      <p key={current} className="sutra-panel-line" aria-live="polite" data-id="sutra-paper-current">
        {line.words.map((word, index) => {
          const global = firstWord + index;
          const state = global < lit ? 'is-lit' : global === lit ? 'is-current' : '';
          return (
            <span key={index} className={`sutra-word ${state}`}>
              {word}{' '}
            </span>
          );
        })}
      </p>
      {next && (
        <p className="sutra-panel-next" data-id="sutra-paper-next">
          {next.words.join(' ')}
        </p>
      )}
    </section>
  );
}
