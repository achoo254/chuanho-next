/**
 * Keyboard play, as a pure key-to-command map: Space or Enter strikes the wooden fish, 1–3 pick a session step, Esc
 * goes back (closes what is open). Space and Enter are left alone while focus is on a button or field, so they keep
 * pressing that control as usual.
 */
import { NUMBER_KEY_ACTIONS, type WorldAction } from '../scene/world-actions';

export type KeyCommand =
  | { readonly kind: 'action'; readonly action: WorldAction }
  | { readonly kind: 'back' }
  | { readonly kind: 'view'; readonly change: 'reset' | 'in' | 'out' };

export function commandForKey(key: string, focusOnControl: boolean): KeyCommand | null {
  if (key === 'Escape') return { kind: 'back' };
  if (focusOnControl) return commandForKeyOnControl(key);
  if (key === 'r' || key === 'R' || key === '0') return { kind: 'view', change: 'reset' };
  if (key === '+' || key === '=') return { kind: 'view', change: 'in' };
  if (key === '-' || key === '_') return { kind: 'view', change: 'out' };
  if (key === ' ' || key === 'Spacebar' || key === 'Enter') return focusOnControl ? null : { kind: 'action', action: 'strike' };
  if (/^[1-9]$/.test(key)) {
    const action = NUMBER_KEY_ACTIONS[Number(key) - 1];
    return action ? { kind: 'action', action } : null;
  }
  return null;
}

/** Keys that keep their meaning while a button or field has focus: only the step shortcuts, not Space or the view keys. */
function commandForKeyOnControl(key: string): KeyCommand | null {
  if (/^[1-9]$/.test(key)) {
    const action = NUMBER_KEY_ACTIONS[Number(key) - 1];
    return action ? { kind: 'action', action } : null;
  }
  return null;
}
