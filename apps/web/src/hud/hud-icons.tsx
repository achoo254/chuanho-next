/**
 * The HUD's line icons (24×24, stroked in the current text colour), so the 3D screen needs almost no words. Each
 * control pairs an icon with an accessible name and a hover hint.
 */
import type { ReactNode } from 'react';
import type { LightingPresetId } from '../scene/lighting-presets';
import type { WorldAction } from '../scene/world-actions';

const PATHS = {
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
  soundOn: 'M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  soundOff: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  sunset: 'M2 18h20M6.5 18a5.5 5.5 0 0 1 11 0M12 6v3M4.9 10.9 7 13M19.1 10.9 17 13M5 22h14',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  mist: 'M8 5h8M4 9h12M2 13h18M6 17h14M9 21h8',
  incense: 'M12 22V10M8 22h8M12 7c-2-1.5 0-3 0-4.5M15.5 8c-1.5-1 0-2.5 0-3.5M8.5 8c-1.5-1 0-2.5 0-3.5',
  mo: 'M3 13c0-4 4-7 9-7s9 3 9 7-4 6-9 6-9-2-9-6zM8 13h8M17 3l-3 4',
  endless: 'M7 8.5a3.5 3.5 0 1 0 0 7c3 0 7-7 10-7a3.5 3.5 0 1 1 0 7c-3 0-7-7-10-7z',
  sutra: 'M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2M6 4v16M9 8h7M9 12h7M9 16h4',
  voice: 'M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M17.5 7.5a4 4 0 0 1 0 5M20 5a7.5 7.5 0 0 1 0 10',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4M12 3v2',
  bowl: 'M3 11h18a9 9 0 0 1-18 0zM8 21h8M12 20v1',
  journal: 'M12 6c-2-1.5-5-2-9-2v15c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2zM12 6v15',
  radio: 'M4 9h16v11H4zM8 9l8-5M8 15a2 2 0 1 0 0-.01M14 13h3M14 16h3',
  soon: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  play: 'M8 5v14l11-7z',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  share: 'M5 12v7h14v-7M12 3v12M7.5 7.5 12 3l4.5 4.5',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  auto: 'M12 4a8 8 0 1 0 8 8M20 4v4h-4M12 8v4l3 2',
  merit: 'M12 20c-4 0-8-3-9-7 3 0 6 1 9 4 3-3 6-4 9-4-1 4-5 7-9 7zM12 17c-2-3-2-7 0-11 2 4 2 8 0 11z',
  combo: 'M12 22c-4 0-7-3-7-7 0-4 3-6 4-10 2 2 3 4 3 6 1-1 2-2 2-4 3 2 5 5 5 8 0 4-3 7-7 7z',
} as const;

export type IconName = keyof typeof PATHS;

export const ACTION_ICONS: Readonly<Record<WorldAction, IconName>> = {
  incense: 'incense',
  beat: 'mo',
  endless: 'endless',
  sutra: 'sutra',
  bell: 'bell',
  bowl: 'bowl',
  journal: 'journal',
  radio: 'radio',
  strike: 'mo',
};

export const PRESET_ICONS: Readonly<Record<LightingPresetId, IconName>> = {
  daylight: 'sun',
  sunset: 'sunset',
  lanternNight: 'moon',
  mistyMorning: 'mist',
};

export function HudIcon({ name, size = 22 }: { name: IconName; size?: number }): ReactNode {
  return (
    <svg className="hud-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface IconButtonProps {
  readonly icon: IconName;
  /** The accessible name, also shown as the hover hint. */
  readonly label: string;
  readonly onClick: () => void;
  readonly pressed?: boolean;
  readonly badge?: IconName;
  readonly dataId: string;
  readonly className?: string;
}

/** A round icon button with a hint bubble on hover and keyboard focus. */
export function IconButton({ icon, label, onClick, pressed, badge, dataId, className }: IconButtonProps): ReactNode {
  return (
    <button
      type="button"
      className={`hud-btn${className ? ` ${className}` : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      data-tip={label}
      data-id={dataId}
      onClick={onClick}
    >
      <HudIcon name={icon} />
      {badge && (
        <span className="hud-btn-badge" aria-hidden="true">
          <HudIcon name={badge} size={12} />
        </span>
      )}
    </button>
  );
}
