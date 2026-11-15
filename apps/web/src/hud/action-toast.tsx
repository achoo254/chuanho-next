/**
 * Small floating feedback over the scene: the toast that confirms a picked action with its icons (plus an hourglass
 * for what is coming soon), and the hint bubble that names the prop under the mouse. Both carry their words for
 * screen readers; on screen they are icons and one short name.
 */
import type { ReactNode } from 'react';
import { type InteractivePropId, type WorldAction, isComingSoon } from '../scene/world-actions';
import { ACTION_ICONS, HudIcon } from './hud-icons';
import { actionKey, propKey, useHudText } from './hud-messages';

export interface ToastContent {
  readonly id: number;
  readonly actions: readonly WorldAction[];
}

export function ActionToast({ toast }: { toast: ToastContent | null }): ReactNode {
  const text = useHudText();
  const names = toast ? toast.actions.map((action) => text(actionKey(action))).join(', ') : '';
  const soon = toast ? toast.actions.some(isComingSoon) : false;
  return (
    // The live region stays mounted so each new pick is announced.
    <div className="game3d-toast-region" role="status" aria-live="polite" data-id="game3d-toast">
      {toast && (
        <div key={toast.id} className="game3d-toast">
          {toast.actions.map((action) => (
            <span key={action} className="game3d-toast-icon">
              <HudIcon name={ACTION_ICONS[action]} size={26} />
            </span>
          ))}
          {soon && (
            <span className="game3d-toast-soon">
              <HudIcon name="soon" size={18} />
            </span>
          )}
          <span className="sr-only">
            {text('picked', { what: names })}
            {soon ? ` (${text('soon')})` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export interface HoverHint {
  readonly prop: InteractivePropId;
  readonly x: number;
  readonly y: number;
}

export function PropHoverHint({ hint }: { hint: HoverHint | null }): ReactNode {
  const text = useHudText();
  if (!hint) return null;
  return (
    <div className="game3d-hover-hint" style={{ left: hint.x, top: hint.y }} aria-hidden="true">
      {text(propKey(hint.prop))}
    </div>
  );
}
