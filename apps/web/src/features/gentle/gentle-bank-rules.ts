/**
 * The editorial rules of the gentle phrase bank, stricter than `parseGentleBank` (which only keeps what is usable at
 * run time and silently drops the rest). Used by `scripts/check-gentle-bank.ts` before the file is committed and by
 * the unit test on the shipped file, so a sentence that would be dropped, repeated or unfit is caught at review time.
 */
import { KARMA_KINDS, foldText, isRecord } from '@chuanho/contract';
import { GENTLE_GROUPS, GENTLE_PHRASE_MAX, GENTLE_TONES, type GentleGroup, parseGentleBank } from './gentle-bank';

export const GENTLE_MIN_PER_TONE = 2;
export const GENTLE_MIN_APOLOGIES = 6;
export const GENTLE_PHRASE_MIN = 12;
/** Labels sit on chips, so they stay short. */
export const GENTLE_LABEL_MAX = 28;

/**
 * Rude words and phrases, matched on diacritic-folded whole words. Only forms that cannot fold onto an ordinary word
 * are listed ("lớn", "các", "buổi" fold onto rude spellings, so those spellings are left out on purpose).
 */
const RUDE_WORDS = new Set(['dm', 'dmm', 'dcm', 'dkm', 'dcmm', 'vcl', 'vkl', 'vl', 'clm', 'cmm', 'ditme', 'dmcs']);
const RUDE_PHRASES = ['dit me', 'du ma', 'oc cho', 'thang cho', 'do ngu', 'cut di', 'im mom'];
/** The bank never borrows the voice of scripture or promises luck. ("nam mo" alone would catch "nằm mơ".) */
const SCRIPTURE_PHRASES = ['nam mo a', 'nam mo bon', 'a di da', 'phat day', 'kinh noi', 'bat nha', 'nghiep bao', 'phat tai', 'giai han'];

const LINK = /https?:|www\.|\b[a-z0-9-]+\.(com|vn|net|org|io|me|app|info|xyz)\b/i;
const PHONE = /\d{9,}/;

export interface GentleBankAudit {
  readonly problems: string[];
  readonly situations: number;
  readonly perGroup: Readonly<Record<GentleGroup, number>>;
  readonly sentences: number;
  readonly apologies: number;
}

/** Problems of one sentence; `where` names its place in the file for the report. */
export function phraseProblems(text: string, where: string): string[] {
  const problems: string[] = [];
  const trimmed = text.trim();
  if (trimmed !== text) problems.push(`${where}: leading or trailing spaces`);
  if (trimmed.length < GENTLE_PHRASE_MIN || trimmed.length > GENTLE_PHRASE_MAX) problems.push(`${where}: length ${trimmed.length} outside ${GENTLE_PHRASE_MIN}-${GENTLE_PHRASE_MAX}`);
  if (trimmed.includes('@') || LINK.test(trimmed) || PHONE.test(trimmed.replace(/(?<=\d)[\s.-]+(?=\d)/g, ''))) problems.push(`${where}: contains a link, email or phone number`);
  const folded = foldText(trimmed);
  const padded = ` ${folded} `;
  if (folded.split(' ').some((word) => RUDE_WORDS.has(word)) || RUDE_PHRASES.some((phrase) => padded.includes(` ${phrase} `))) problems.push(`${where}: rude wording`);
  if (SCRIPTURE_PHRASES.some((phrase) => padded.includes(` ${phrase} `))) problems.push(`${where}: scripture or luck wording`);
  return problems;
}

/** Every string of an array field, or a problem when the field is not an array of strings. */
function rawStrings(raw: unknown, where: string, problems: string[]): string[] {
  const list = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
  if (!Array.isArray(raw) || list.length !== raw.length) problems.push(`${where}: not a list of sentences`);
  return list;
}

/** Checks a raw bank file against every rule; an empty `problems` list means it may ship. */
export function auditGentleBank(raw: unknown): GentleBankAudit {
  const problems: string[] = [];
  const perGroup = Object.fromEntries(GENTLE_GROUPS.map((group) => [group, 0])) as Record<GentleGroup, number>;
  const empty: GentleBankAudit = { problems, situations: 0, perGroup, sentences: 0, apologies: 0 };
  const parsed = parseGentleBank(raw);
  if (!parsed || !isRecord(raw) || !Array.isArray(raw.situations) || !isRecord(raw.apologies)) {
    problems.push('the file is not a usable version 1 bank');
    return empty;
  }
  const seenText = new Map<string, string>();
  const checkText = (text: string, where: string): void => {
    problems.push(...phraseProblems(text, where));
    const key = text.trim();
    const first = seenText.get(key);
    if (first) problems.push(`${where}: same sentence as ${first}`);
    else seenText.set(key, where);
  };

  const seenIds = new Set<string>();
  let sentences = 0;
  raw.situations.forEach((entry: unknown, index) => {
    const id = isRecord(entry) && typeof entry.id === 'string' ? entry.id : `#${index}`;
    if (seenIds.has(id)) problems.push(`${id}: duplicate id`);
    seenIds.add(id);
    const kept = parsed.situations.find((situation) => situation.id === id);
    if (!kept || !isRecord(entry) || !isRecord(entry.tones)) {
      problems.push(`${id}: dropped by the parser (bad id, group, label or tones)`);
      return;
    }
    if (kept.label.length > GENTLE_LABEL_MAX) problems.push(`${id}: label longer than ${GENTLE_LABEL_MAX}`);
    for (const tone of GENTLE_TONES) {
      const list = rawStrings(entry.tones[tone], `${id}.${tone}`, problems);
      if (list.length < GENTLE_MIN_PER_TONE) problems.push(`${id}.${tone}: fewer than ${GENTLE_MIN_PER_TONE} sentences`);
      list.forEach((text, i) => checkText(text, `${id}.${tone}[${i}]`));
      sentences += list.length;
    }
  });
  for (const situation of parsed.situations) perGroup[situation.group] += 1;

  let apologies = 0;
  for (const kind of KARMA_KINDS) {
    const list = rawStrings(raw.apologies[kind], `apologies.${kind}`, problems);
    if (list.length < GENTLE_MIN_APOLOGIES) problems.push(`apologies.${kind}: fewer than ${GENTLE_MIN_APOLOGIES} sentences`);
    list.forEach((text, i) => checkText(text, `apologies.${kind}[${i}]`));
    apologies += list.length;
  }
  return { problems, situations: parsed.situations.length, perGroup, sentences, apologies };
}
