/**
 * The HTML layer over the canvas: merit and best combo top left (with the "Giờ Tĩnh" chip under them in the yard);
 * the account and one settings icon (time of day, sound, language, about) top right; the corner icon bar (every action without aiming at the scene) at the bottom. No title, no intro
 * paragraph, no promise strip: the yard itself is the screen.
 */
import type { ReactNode } from 'react';
import { AccountButton } from '../account/account-button';
import { useGameSession } from '../game/game-session-context';
import { QuietHourChip } from '../quiet-hour/quiet-hour-chip';
import type { LightingPresetId } from '../scene/lighting-presets';
import { SHORTCUT_BAR_ACTIONS, type WorldAction, isComingSoon } from '../scene/world-actions';
import { ACTION_ICONS, HudIcon, IconButton } from './hud-icons';
import { actionKey, useHudText } from './hud-messages';
import { SettingsMenu } from './settings-menu';

interface GameHudProps {
  readonly preset: LightingPresetId;
  /** The corner icon bar shows in the yard; inside a play mode the mode's own bar takes its place. */
  readonly showBar: boolean;
  readonly muted: boolean;
  onAction(action: WorldAction): void;
  onPreset(preset: LightingPresetId): void;
  onToggleSound(): void;
  onInfo(): void;
  /** Shown only while the free camera is away from the framed view. */
  readonly viewChanged: boolean;
  onResetView(): void;
}

export function GameHud({ preset, showBar, muted, onAction, onPreset, onToggleSound, onInfo, viewChanged, onResetView }: GameHudProps): ReactNode {
  const { progress } = useGameSession();
  const text = useHudText();
  return (
    <>
      <div className="game3d-hud-top" data-id="game3d-hud-top">
        <div className="game3d-hud-left">
          <ul className="game3d-stats" aria-label={text('stats')} data-id="game3d-stats">
            <li className="game3d-stat" data-tip={text('merit', { n: progress.merit })}>
              <HudIcon name="merit" size={18} />
              <span aria-hidden="true">{progress.merit}</span>
              <span className="sr-only">{text('merit', { n: progress.merit })}</span>
            </li>
            <li className="game3d-stat" data-tip={text('bestCombo', { n: progress.bestCombo })}>
              <HudIcon name="combo" size={18} />
              <span aria-hidden="true">{progress.bestCombo}</span>
              <span className="sr-only">{text('bestCombo', { n: progress.bestCombo })}</span>
            </li>
          </ul>
          {showBar && <QuietHourChip />}
        </div>
        <div className="game3d-controls" data-id="game3d-controls">
          {viewChanged && <IconButton icon="resetView" label={text('resetView')} dataId="game3d-reset-view" onClick={onResetView} />}
          <AccountButton />
          <SettingsMenu preset={preset} muted={muted} onPreset={onPreset} onToggleSound={onToggleSound} onInfo={onInfo} />
        </div>
      </div>
      {showBar && (
      <nav className="game3d-bar" aria-label={text('shortcuts')} data-id="game3d-bar">
        {SHORTCUT_BAR_ACTIONS.map((action) => (
          <IconButton
            key={action}
            icon={ACTION_ICONS[action]}
            label={isComingSoon(action) ? `${text(actionKey(action))} (${text('soon')})` : text(actionKey(action))}
            badge={isComingSoon(action) ? 'soon' : undefined}
            className={isComingSoon(action) ? 'is-soon' : undefined}
            dataId={`game3d-bar-${action}`}
            onClick={() => onAction(action)}
          />
        ))}
      </nav>
      )}
    </>
  );
}
