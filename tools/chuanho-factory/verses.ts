/**
 * The verse bank (verses.json): short calm lines Claude writes and the PC only reads aloud. The validator runs
 * before any voice job and in the tests, so a bad edit never reaches the TTS or a video.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calmTextProblems } from './calm-text-guard';
import { isTimeOfDay, type TimeOfDay } from './job-types';

export interface Verse {
  readonly id: string;
  /** Scene the line suits; `any` fits every scene. */
  readonly time: TimeOfDay | 'any';
  readonly text: string;
}

export const VERSE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verses.json');

const ID = /^[a-z0-9-]{1,40}$/;
const MIN_CHARS = 10;
const MAX_CHARS = 80;
const MIN_WORDS = 4;
const MAX_WORDS = 16;

/** Validates the parsed file; returns the verses or every problem found. */
export function validateVerses(raw: unknown): { verses: Verse[]; problems: string[] } {
  const list = typeof raw === 'object' && raw !== null ? (raw as { verses?: unknown }).verses : undefined;
  if (!Array.isArray(list)) return { verses: [], problems: ['verses.json has no "verses" list'] };
  const verses: Verse[] = [];
  const problems: string[] = [];
  const ids = new Set<string>();
  const texts = new Set<string>();
  list.forEach((entry: unknown, index) => {
    const e = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {};
    const where = typeof e.id === 'string' ? e.id : `entry ${index}`;
    const before = problems.length;
    if (typeof e.id !== 'string' || !ID.test(e.id)) problems.push(`${where}: id must match ${ID.source}`);
    else if (ids.has(e.id)) problems.push(`${where}: duplicate id`);
    if (e.time !== 'any' && !isTimeOfDay(e.time)) problems.push(`${where}: time must be any, morning, noon, evening or night`);
    if (typeof e.text !== 'string') {
      problems.push(`${where}: text missing`);
    } else {
      const text = e.text.normalize('NFC').trim();
      const words = text.split(/\s+/).length;
      if (text.length < MIN_CHARS || text.length > MAX_CHARS) problems.push(`${where}: ${text.length} characters (${MIN_CHARS}-${MAX_CHARS})`);
      if (words < MIN_WORDS || words > MAX_WORDS) problems.push(`${where}: ${words} words (${MIN_WORDS}-${MAX_WORDS})`);
      // The TTS normaliser misreads digits and dates; numbers are written as words.
      if (/\d/.test(text)) problems.push(`${where}: write numbers as words`);
      if (!/[.!?…]$/.test(text)) problems.push(`${where}: end with a full stop so the voice falls`);
      if (texts.has(text.toLowerCase())) problems.push(`${where}: same text as another verse`);
      for (const problem of calmTextProblems(text)) problems.push(`${where}: ${problem}`);
      texts.add(text.toLowerCase());
    }
    if (problems.length === before && typeof e.id === 'string' && typeof e.text === 'string' && (e.time === 'any' || isTimeOfDay(e.time))) {
      ids.add(e.id);
      verses.push({ id: e.id, time: e.time, text: e.text.normalize('NFC').trim() });
    }
  });
  if (list.length === 0) problems.push('verses.json has no verses');
  return { verses, problems };
}

export async function loadVerses(file: string = VERSE_FILE): Promise<Verse[]> {
  const { verses, problems } = validateVerses(JSON.parse(await readFile(file, 'utf8')));
  if (problems.length > 0) throw new Error(`${file}:\n  ${problems.join('\n  ')}`);
  return verses;
}

/** Verses that suit a scene: its own time first, then the ones for any time. */
export function versesFor(verses: readonly Verse[], time: TimeOfDay): Verse[] {
  return [...verses.filter((v) => v.time === time), ...verses.filter((v) => v.time === 'any')];
}
