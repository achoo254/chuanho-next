/**
 * The forms a wish is matched in. Every form starts from NFKC, so full-width digits and letters ("０９１", "ｏｔｐ") are
 * plain ones. Pure string helpers, shared by the wish filter and the web's own word checks.
 */

/** NFKC, lowercase, whitespace collapsed and trimmed: the text as written, minus look-alike code points. */
export const normalizeWishText = (text: string): string => text.normalize('NFKC').replace(/\s+/g, ' ').trim();

/** Lowercase, no diacritics, `đ` as `d`, anything that is not a letter or digit folded to a single space. */
export function foldText(text: string): string {
  return text
    .normalize('NFKC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lowercase with diacritics kept (NFC), anything that is not a letter or digit folded to a single space. */
export const accentedText = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Joins runs of one-character words of a folded text, so a spaced-out "o t p" or "s t k" reads "otp", "stk". */
export function squeezeSpacedLetters(folded: string): string {
  const out: string[] = [];
  let run = '';
  for (const word of folded.split(' ')) {
    if (word.length === 1) {
      run += word;
      continue;
    }
    if (run) out.push(run);
    run = '';
    out.push(word);
  }
  if (run) out.push(run);
  return out.join(' ');
}

const LEET: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e' };

/** Reads 0, 1 and 3 as o, i and e inside words that also hold letters ("m0m0" is "momo"; "500" stays a number). */
export const unLeet = (folded: string): string =>
  folded
    .split(' ')
    .map((word) => (/[a-z]/.test(word) ? word.replace(/[013]/g, (digit) => LEET[digit] ?? digit) : word))
    .join(' ');

/** True when `phrase` (words separated by single spaces) appears as whole words in `form`. */
export const hasPhrase = (form: string, phrase: string): boolean => ` ${form} `.includes(` ${phrase} `);
