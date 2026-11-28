/**
 * The settings button of the top bar and the small panel it opens: time of day (pick a look directly), sound, language
 * and the about panel. Everything that is a setting rather than a way to play lives here, so the top bar keeps only the
 * stats, the account and this one icon. The panel closes on Esc, on a tap outside, and after "about".
 */
import { LanguageSwitch } from '@achoo254/app-shell';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { brand } from '../brand';
import { LOCALES, useI18n } from '../i18n/i18n';
import { LIGHTING_PRESET_IDS, type LightingPresetId } from '../scene/lighting-presets';
import { HudIcon, IconButton, PRESET_ICONS } from './hud-icons';
import { presetKey, useHudText } from './hud-messages';

interface SettingsMenuProps {
  readonly preset: LightingPresetId;
  readonly muted: boolean;
  onPreset(preset: LightingPresetId): void;
  onToggleSound(): void;
  onInfo(): void;
}

export function SettingsMenu({ preset, muted, onPreset, onToggleSound, onInfo }: SettingsMenuProps): ReactNode {
  const { locale, setLocale } = useI18n();
  const text = useHudText();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings-menu" ref={root} data-id="game3d-settings">
      <IconButton icon="settings" label={text('settings')} pressed={open} dataId="game3d-settings-open" onClick={() => setOpen((value) => !value)} />
      {open && (
        <div className="settings-panel" role="group" aria-label={text('settings')} data-id="game3d-settings-panel">
          <div className="settings-row">
            <span className="settings-label">{text('timeOfDayLabel')}</span>
            <div className="settings-choices">
              {LIGHTING_PRESET_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="hud-btn"
                  aria-pressed={id === preset}
                  aria-label={text(presetKey(id))}
                  data-tip={text(presetKey(id))}
                  data-id={`game3d-time-${id}`}
                  onClick={() => onPreset(id)}
                >
                  <HudIcon name={PRESET_ICONS[id]} />
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">{text('soundLabel')}</span>
            <button
              type="button"
              className="hud-btn"
              aria-pressed={!muted}
              aria-label={muted ? text('soundOn') : text('soundOff')}
              data-tip={muted ? text('soundOn') : text('soundOff')}
              data-id="game3d-sound"
              onClick={onToggleSound}
            >
              <HudIcon name={muted ? 'soundOff' : 'soundOn'} />
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-label">{text('languageLabel')}</span>
            <LanguageSwitch locale={locale} locales={LOCALES} domain={brand.primaryTenant.domain} onLocaleChange={setLocale} />
          </div>
          <button
            type="button"
            className="settings-about"
            data-id="game3d-info-open"
            onClick={() => {
              setOpen(false);
              onInfo();
            }}
          >
            <HudIcon name="info" size={20} />
            {text('info')}
          </button>
        </div>
      )}
    </div>
  );
}
