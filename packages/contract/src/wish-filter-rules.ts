/**
 * What the wish filter looks for: contact details, links, money asks and rude words. Each rule gets the forms of
 * `WishForms` it needs; words whose folded spelling is an everyday word ("chăm mẹ" folds to "cham me", "đủ mà" to
 * "du ma") are matched with their diacritics so the everyday sentence passes.
 */
import { hasPhrase } from './wish-text-forms';

export interface WishForms {
  /** NFKC, whitespace collapsed (the text as written). */
  readonly text: string;
  /** `foldText`: no diacritics, words only. */
  readonly folded: string;
  /** Folded, spaced-out letters joined and 0/1/3 read as letters inside words ("o t p", "m0m0"). */
  readonly squeezed: string;
  /** Lowercase words with their diacritics. */
  readonly accented: string;
}

/** The folded forms a phrase rule is checked in. */
const foldedForms = (forms: WishForms): readonly string[] => [forms.folded, forms.squeezed];
const anyPhrase = (forms: WishForms, phrases: readonly string[]): boolean =>
  foldedForms(forms).some((form) => phrases.some((phrase) => hasPhrase(form, phrase)));

export const isEmail = (forms: WishForms): boolean => forms.text.includes('@') || / at [a-z0-9]+ (com|vn|net)\b/.test(forms.folded);

/**
 * Phone-like: a run of 9 or more digits once anything that is neither letter nor digit between two digits is dropped
 * ("091/234/5678", "091,234,5678" and "0912 345 678" all count). A date with a time ("15/11/2026 10:30") reads as a
 * long run too; a wish rarely carries one, and a false refusal only asks for a rewrite.
 */
export function hasPhoneNumber(forms: WishForms): boolean {
  const joined = forms.text.replace(/(?<=\p{N})[^\p{L}\p{N}]+(?=\p{N})/gu, '');
  return /\d{9,}/.test(joined) || /\b(0|84)\s?\d{2,3}\s?\d{3}\s?\d{3,4}\b/.test(forms.text);
}

const TLDS = 'com|vn|net|org|io|me|xyz|info|link|app|co|ly|gg|tk|shop|site|online|top|club|biz';
/** `name.tld` with nothing around the dot ("xong. Ngủ" has a space), or `a.b/path`. */
const DOMAIN = new RegExp(`[a-z0-9-]\\.(?:${TLDS})(?![\\p{L}\\p{N}])|[a-z0-9-]{2,}\\.[a-z]{2,}\\/`, 'u');
/**
 * A dot with spaces around it: only before a path ("abc . com/xyz") or a TLD that is no everyday word, because a
 * sentence's "xong. Net lag" or "rồi. Top 1" would match otherwise.
 */
const SPACED_DOMAIN = new RegExp(`[a-z0-9-]{2,} *\\. *(?:(?:${TLDS}) *\\/|(?:com|org|xyz|info|biz)(?![\\p{L}\\p{N}]))`, 'u');
/** "abc[.]com", "abc(.)com", "abc{dot}com" and the like, rewritten to a plain dot. */
const BRACKETED_DOT = /\s*[[({<]\s*(?:\.|dot|chấm|cham)\s*[\])}>]\s*/gu;
/** Spelt-out links on the accented words, so "chấm me" (dot me) is a link and "chăm mẹ" is not. */
const SPELT_LINK = new RegExp(`(?:^| )(?:(?:chấm|cham|dot) (?:${TLDS})|bit ly|zalo me|t me)(?= |$)`, 'u');

export function hasLink(forms: WishForms): boolean {
  if (/(?:^| )(?:https?|www)(?= |$)/.test(forms.folded)) return true;
  if (SPELT_LINK.test(forms.accented)) return true;
  const dotted = forms.text.toLowerCase().replace(BRACKETED_DOT, '.');
  return DOMAIN.test(dotted) || SPACED_DOMAIN.test(dotted);
}

/** Money and account asks that no everyday wish carries. */
const MONEY_ALWAYS = [
  'chuyen khoan',
  'so tai khoan',
  'tai khoan ngan hang',
  'stk',
  'otp',
  'ma xac nhan',
  'ma xac thuc',
  'mat khau',
  'the cao',
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
];
/** Innocent alone ("Mong đậu vào ngân hàng"); a money ask only next to an amount, an account or a contact. */
const MONEY_IN_CONTEXT = ['kiem tien', 'ngan hang', 'dau tu', 'trung thuong', 'lai suat', 'ck'];
/** "ck" is also teencode for "chồng": a transfer only when one of these follows it (or with an amount, account…). */
const CK_TRANSFER_NEXT = ['cho', 'qua', 'vao', 'giup', 'ho', 'gap', 'lien', 'truoc'];
const ACCOUNT_OR_CONTACT = ['tai khoan', 'tk', 'so tk', 'zalo', 'ib', 'inbox', 'lien he', 'sdt', 'so dien thoai', 'tele', 'telegram', 'fb', 'facebook', 'nhan tin', 'ket ban'];

export function isMoneyAsk(forms: WishForms): boolean {
  if (anyPhrase(forms, MONEY_ALWAYS)) return true;
  if (!anyPhrase(forms, MONEY_IN_CONTEXT)) return false;
  if (/\p{N}/u.test(forms.text) || anyPhrase(forms, ACCOUNT_OR_CONTACT) || hasLink(forms)) return true;
  // Only "ck" is left to settle: a bare "ck" or "ck cho…" is a transfer, "Mong ck thương" is a husband.
  return forms.folded === 'ck' || anyPhrase(forms, CK_TRANSFER_NEXT.map((word) => `ck ${word}`));
}

/** Teencode with no innocent look-alike, matched on the folded forms as whole words, so "dm" does not catch "admin". */
const RUDE_WORDS = new Set(['dm', 'dmm', 'vcl', 'vkl', 'clm', 'cc', 'cl', 'dit', 'dcm', 'cmm', 'dkm', 'ditme']);
const RUDE_PHRASES = ['dit me', 'dit con'];
/**
 * Words and phrases whose folded form is an everyday one ("lồn"/"lớn", "cặc"/"các", "buồi"/"buổi", "đéo"/"đeo",
 * "chó đẻ"/"cho dễ", "con chó"/"còn chờ", "đồ ngu"/"đồ ngủ", "đụ má"/"đủ mà"): matched with their diacritics.
 */
const RUDE_ACCENTED_WORDS = new Set(['lồn', 'cặc', 'buồi', 'đéo', 'địt', 'đĩ', 'đụ']);
const RUDE_ACCENTED_PHRASES = ['con chó', 'thằng chó', 'óc chó', 'chó đẻ', 'mẹ mày', 'chết mẹ', 'đồ ngu', 'đụ má', 'đù má', 'đụ mẹ'];
/** "chết đi" is a curse, "mệt chết đi được" a sigh. */
const DIE_CURSE = /(?:^| )chết đi(?! được)(?= |$)/u;

export function isRude(forms: WishForms): boolean {
  if (anyPhrase(forms, RUDE_PHRASES)) return true;
  if (foldedForms(forms).some((form) => form.split(' ').some((word) => RUDE_WORDS.has(word)))) return true;
  if (RUDE_ACCENTED_PHRASES.some((phrase) => hasPhrase(forms.accented, phrase)) || DIE_CURSE.test(forms.accented)) return true;
  return forms.accented.split(' ').some((word) => RUDE_ACCENTED_WORDS.has(word));
}
