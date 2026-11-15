/**
 * The wish filter of the shared incense room (also applied to room names): one short line, never a channel for contact
 * details, links or money. Runs on the device for instant feedback and again on the server, which is the one that
 * decides. Matching runs on several forms of the text (see `WishForms`), so "chuyển khoản" and "chuyen-khoan",
 * "０９１２…" and "0912…", "o t p" and "otp" are the same.
 */
import { type WishForms, hasLink, hasPhoneNumber, isEmail, isMoneyAsk, isRude } from './wish-filter-rules';
import { accentedText, foldText, normalizeWishText, squeezeSpacedLetters, unLeet } from './wish-text-forms';

export { foldText } from './wish-text-forms';

export const WISH_MAX = 80;

export type WishRejection = 'empty' | 'tooLong' | 'phone' | 'link' | 'email' | 'money' | 'rude';

export type WishCheck = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: WishRejection };

/** Checks one line of text; `max` is the length limit (a wish's by default). An accepted text comes back normalized. */
export function checkWish(raw: string, max: number = WISH_MAX): WishCheck {
  const text = normalizeWishText(raw);
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > max) return { ok: false, reason: 'tooLong' };
  const folded = foldText(text);
  const forms: WishForms = { text, folded, squeezed: unLeet(squeezeSpacedLetters(folded)), accented: accentedText(text) };
  if (isEmail(forms)) return { ok: false, reason: 'email' };
  if (hasPhoneNumber(forms)) return { ok: false, reason: 'phone' };
  if (hasLink(forms)) return { ok: false, reason: 'link' };
  if (isMoneyAsk(forms)) return { ok: false, reason: 'money' };
  if (isRude(forms)) return { ok: false, reason: 'rude' };
  return { ok: true, text };
}
