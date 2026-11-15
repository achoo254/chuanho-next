/**
 * The deck behind "Xin xăm": 64 self-written quẻ (name, two lục bát lines, a plain-words meaning and a small thing to
 * do today), shipped as a static file (/content/que.json, its `source` field says where the text comes from). The
 * file comes over the network, so it is validated here; a broken entry is dropped, a deck without enough usable quẻ
 * is refused rather than shown half-way.
 *
 * File shape (version 1):
 *   { "version": 1, "source": "…",
 *     "que": [ { "title": "…", "verse": ["…", "…"], "meaning": "…", "advice": "…" } ] }
 */
import { isRecord } from '@chuanho/contract';

export const QUE_DECK_URL = '/content/que.json';
/** Longest text field accepted (the longest shipped meaning is well under it). */
export const QUE_TEXT_MAX = 400;
/** The picker needs at least two quẻ so a day never repeats the day before. */
export const QUE_DECK_MIN = 2;

export interface Que {
  readonly title: string;
  readonly verse: readonly [string, string];
  readonly meaning: string;
  readonly advice: string;
}

export interface QueDeck {
  readonly que: readonly Que[];
}

function text(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= QUE_TEXT_MAX ? trimmed : null;
}

function parseQue(raw: unknown): Que | null {
  if (!isRecord(raw) || !Array.isArray(raw.verse) || raw.verse.length !== 2) return null;
  const title = text(raw.title);
  const first = text(raw.verse[0]);
  const second = text(raw.verse[1]);
  const meaning = text(raw.meaning);
  const advice = text(raw.advice);
  if (title === null || first === null || second === null || meaning === null || advice === null) return null;
  return { title, verse: [first, second], meaning, advice };
}

/** Validates a downloaded deck; null when it is not a usable version 1 deck. */
export function parseQueDeck(raw: unknown): QueDeck | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.que)) return null;
  const que = raw.que.map(parseQue).filter((entry): entry is Que => entry !== null);
  return que.length >= QUE_DECK_MIN ? { que } : null;
}

let cached: Promise<QueDeck | null> | null = null;

/** Fetches the deck once per page load (the service worker or HTTP cache keeps it for offline); null when unavailable. */
export function loadQueDeck(): Promise<QueDeck | null> {
  cached ??= fetch(QUE_DECK_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then(parseQueDeck)
    .catch((error: unknown) => {
      console.warn('Fortune deck unavailable', error);
      cached = null;
      return null;
    });
  return cached;
}

/** The text that goes to the clipboard or the share sheet: the quẻ alone, nothing about the player. */
export function queShareText(que: Que, footer: string): string {
  return [`🎋 ${que.title}`, `${que.verse[0]}`, `${que.verse[1]}`, '', que.meaning, `→ ${que.advice}`, '', footer].join('\n');
}
