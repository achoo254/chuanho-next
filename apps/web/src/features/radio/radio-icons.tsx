/**
 * The radio's few icons the HUD set does not have (pause, next track, timer, dim), drawn in the same 24×24 stroked
 * style and class as hud-icons.tsx; every other icon comes from the HUD set.
 */
import type { ReactNode } from 'react';
import { HudIcon, type IconName } from '../../hud/hud-icons';

const RADIO_PATHS = {
  pause: 'M8 5v14M16 5v14',
  next: 'M6 5l9 7-9 7zM18 5v14',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2.5 2M10 2h4',
  dim: 'M3 5h18v12H3zM8 21h8M12 17v4M14.5 8.5a3 3 0 1 0 0 5 3.5 3.5 0 0 1 0-5z',
} as const;

export type RadioIconName = IconName | keyof typeof RADIO_PATHS;

const isRadioOnly = (name: RadioIconName): name is keyof typeof RADIO_PATHS => name in RADIO_PATHS;

export function RadioIcon({ name, size = 22 }: { name: RadioIconName; size?: number }): ReactNode {
  if (!isRadioOnly(name)) return <HudIcon name={name} size={size} />;
  return (
    <svg className="hud-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={RADIO_PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
