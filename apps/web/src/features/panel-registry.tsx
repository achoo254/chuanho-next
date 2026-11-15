/**
 * Where the feature screens plug in. A play mode that is only an HTML panel over the yard (no strike pad, no beat
 * stage) is one line here plus its entries in `PLAY_MODES` (play-mode-routing.ts), `WORLD_ACTIONS`/`PROP_ACTIONS`
 * (world-actions.ts), the icon and name of its action (hud-icons.tsx, hud-messages.ts) and its camera look
 * (play-stage.ts). Each panel loads in its own chunk, only when first opened.
 */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import type { PlayModeProps } from '../modes/mode-chrome';
import type { PlayMode } from '../modes/play-mode-routing';
import type { LightingPresetId } from '../scene/lighting-presets';

/** The time-of-day control a panel may use (the radio dims the yard for sleep) and must restore when it closes. */
export interface LightingControl {
  readonly preset: LightingPresetId;
  set(preset: LightingPresetId): void;
}

export interface PanelProps extends PlayModeProps {
  readonly lighting: LightingControl;
}

type PanelComponent = LazyExoticComponent<ComponentType<PanelProps>>;

export const PANEL_MODES = {
  journal: lazy(() => import('./journal/journal-panel').then((m) => ({ default: m.JournalPanel }))),
  gentle: lazy(() => import('./gentle/gentle-panel').then((m) => ({ default: m.GentlePanel }))),
  radio: lazy(() => import('./radio/radio-panel').then((m) => ({ default: m.RadioPanel }))),
  fortune: lazy(() => import('./fortune/fortune-panel').then((m) => ({ default: m.FortunePanel }))),
  room: lazy(() => import('./room/room-panel').then((m) => ({ default: m.RoomPanel }))),
} satisfies Partial<Record<PlayMode, PanelComponent>>;

export type PanelMode = keyof typeof PANEL_MODES;

export const isPanelMode = (mode: PlayMode): mode is PanelMode => mode in PANEL_MODES;
