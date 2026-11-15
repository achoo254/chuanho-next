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

const LINK = /(https?\b|\bwww\b|\b[a-z0-9-]+ (com|vn|net|org|io|me|xyz|info|link|app|co) ?\b|\bbit ly\b|\bzalo me\b|\bt me\b)/;
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
/** Short rude words are matched as whole words only, so "dm" does not catch "admin". */
const RUDE_WORDS = new Set(['dm', 'dmm', 'vcl', 'vl', 'clm', 'cc', 'cl', 'dit', 'deo', 'lon', 'cac', 'buoi', 'dcm', 'cmm', 'dkm', 'ditme', 'ngu', 'cho de', 'oc cho']);
const RUDE_PHRASES = ['dit me', 'con cho', 'thang cho', 'oc cho', 'cho de', 'du ma', 'me may', 'chet di', 'chet me', 'do ngu'];

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
  if (LINK.test(folded) || /[a-z0-9]\.[a-z]{2,}(\/|\b)/i.test(text.replace(/\s/g, ''))) return { ok: false, reason: 'link' };
  const padded = ` ${folded} `;
  if (MONEY.some((phrase) => padded.includes(` ${phrase} `))) return { ok: false, reason: 'money' };
  if (RUDE_PHRASES.some((phrase) => padded.includes(` ${phrase} `)) || folded.split(' ').some((word) => RUDE_WORDS.has(word))) return { ok: false, reason: 'rude' };
  return { ok: true, text };
}
