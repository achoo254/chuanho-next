/**
 * The wish filter of the shared incense room: a wish is one short line, never a channel for contact details, links or
 * money. Runs on the device for instant feedback and again on the server, which is the one that decides. Matching is
 * done on the text with diacritics and punctuation folded away, so "chuyển khoản" and "chuyen-khoan" are the same.
 */

export const WISH_MAX = 80;

export type WishRejection = 'empty' | 'tooLong' | 'phone' | 'link' | 'email' | 'money' | 'rude';

export type WishCheck = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: WishRejection };

/** Lowercase, no diacritics, `đ` as `d`, anything that is not a letter or digit folded to a single space. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Links on the folded text: schemes, `www`, short-link hosts and a domain spelt out ("abc chấm com"). A dotted domain
 * is caught on the raw text instead (DOMAIN), because folding turns every "word. Word" into two plain words and
 * "có"/"mẹ" into the endings "co"/"me".
 */
const LINK = /(https?\b|\bwww\b|\b(cham|dot) (com|vn|net|org|io|me|xyz|info|link|app|co)\b|\bbit ly\b|\bzalo me\b|\bt me\b)/;
const TLDS = 'com|vn|net|org|io|me|xyz|info|link|app|co|ly|gg|tk|shop|site|online|top|club|biz';
/** `name.tld` with nothing between the dot and its neighbours (a sentence's "xong. Ngủ" has a space), or `a.b/path`. */
const DOMAIN = new RegExp(`[a-z0-9-]\\.(?:${TLDS})(?![a-z0-9])|[a-z0-9-]{2,}\\.[a-z]{2,}\\/`, 'i');
const MONEY = [
  'chuyen khoan',
  'so tai khoan',
  'tai khoan ngan hang',
  'ngan hang',
  'stk',
  'otp',
  'ma xac nhan',
  'ma xac thuc',
  'cho vay',
  'vay tien',
  'xin tien',
  'gui tien',
  'nap tien',
  'momo',
  'zalopay',
  'vnpay',
  'crypto',
  'usdt',
  'bitcoin',
  'dau tu',
  'lai suat',
  'kiem tien',
  'trung thuong',
];
/**
 * Teencode with no innocent look-alike, matched on the folded text as whole words, so "dm" does not catch "admin".
 */
const RUDE_WORDS = new Set(['dm', 'dmm', 'vcl', 'vkl', 'vl', 'clm', 'cc', 'cl', 'dit', 'dcm', 'cmm', 'dkm', 'ditme']);
const RUDE_PHRASES = ['dit me', 'dit con', 'du ma'];
/**
 * Words and phrases whose folded form is an everyday one ("lồn"/"lớn", "cặc"/"các", "buồi"/"buổi", "đéo"/"đeo",
 * "chó đẻ"/"cho dễ", "con chó"/"còn chờ", "đồ ngu"/"đồ ngủ"): matched with their diacritics, as whole words.
 */
const RUDE_ACCENTED_WORDS = new Set(['lồn', 'cặc', 'buồi', 'đéo', 'địt', 'đĩ', 'đụ']);
const RUDE_ACCENTED_PHRASES = ['con chó', 'thằng chó', 'óc chó', 'chó đẻ', 'mẹ mày', 'chết đi', 'chết mẹ', 'đồ ngu', 'đụ má'];

/** Lowercase with diacritics kept (NFC), anything that is not a letter or digit folded to a single space. */
const accentedWords = (text: string): string =>
  text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function isRude(text: string, folded: string): boolean {
  const padded = ` ${folded} `;
  if (RUDE_PHRASES.some((phrase) => padded.includes(` ${phrase} `)) || folded.split(' ').some((word) => RUDE_WORDS.has(word))) return true;
  const accented = accentedWords(text);
  const paddedAccented = ` ${accented} `;
  return RUDE_ACCENTED_PHRASES.some((phrase) => paddedAccented.includes(` ${phrase} `)) || accented.split(' ').some((word) => RUDE_ACCENTED_WORDS.has(word));
}

/** Phone-like: a run of 9 or more digits once spaces, dots and dashes between digits are ignored. */
function hasPhoneNumber(text: string): boolean {
  const digitsOnly = text.replace(/(?<=\d)[\s.\-_()+](?=\d)/g, '');
  return /\d{9,}/.test(digitsOnly);
}

export function checkWish(raw: string): WishCheck {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > WISH_MAX) return { ok: false, reason: 'tooLong' };
  const folded = foldText(text);
  if (text.includes('@') || / at [a-z0-9]+ (com|vn|net)\b/.test(folded)) return { ok: false, reason: 'email' };
  if (hasPhoneNumber(text) || /\b(0|84)\s?\d{2,3}\s?\d{3}\s?\d{3,4}\b/.test(text)) return { ok: false, reason: 'phone' };
  if (LINK.test(folded) || DOMAIN.test(text)) return { ok: false, reason: 'link' };
  const padded = ` ${folded} `;
  if (MONEY.some((phrase) => padded.includes(` ${phrase} `))) return { ok: false, reason: 'money' };
  if (isRude(text, folded)) return { ok: false, reason: 'rude' };
  return { ok: true, text };
}
