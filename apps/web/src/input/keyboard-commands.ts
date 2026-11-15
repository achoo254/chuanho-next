/**
 * Keyboard play, as a pure key-to-command map: Space or Enter strikes the wooden fish, 1–3 pick a session step, Esc
 * goes back (closes what is open). Space and Enter are left alone while focus is on a button or field, so they keep
 * pressing that control as usual.
 */
import { NUMBER_KEY_ACTIONS, type WorldAction } from '../scene/world-actions';

export type KeyCommand = { readonly kind: 'action'; readonly action: WorldAction } | { readonly kind: 'back' };

export function commandForKey(key: string, focusOnControl: boolean): KeyCommand | null {
  if (key === 'Escape') return { kind: 'back' };
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') return focusOnControl ? null : { kind: 'action', action: 'strike' };
  if (/^[1-9]$/.test(key)) {
    const action = NUMBER_KEY_ACTIONS[Number(key) - 1];
    return action ? { kind: 'action', action } : null;
  }
  return null;
}
