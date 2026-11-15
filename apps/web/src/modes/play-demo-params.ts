/**
 * Address parameters that put the 3D game straight into a state, for screenshots and quick checks on a device:
 *
 * - `play=<mode>` opens that play mode at once (no Start screen; sound unlocks on the first tap as usual).
 * - `freeze=<ms>` holds the strike at that many ms after the touch (45 = the hit), the character mid-swing.
 * - `song=<ms>` (with `play=beat`) shows a Mõ Beat song stopped at that time, earlier notes already hit.
 *
 * Nothing here changes saved progress. Without these parameters the game starts on its Start screen as normal.
 */
import { PLAY_MODES, type PlayMode } from './play-mode-routing';

export interface PlayDemoParams {
  readonly mode: PlayMode | null;
  readonly freezeStrikeMs: number | null;
  readonly songMs: number | null;
}

function nonNegative(raw: string | null, max: number): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

export function playDemoParams(search: string): PlayDemoParams {
  const params = new URLSearchParams(search);
  const asked = params.get('play');
  const mode = (PLAY_MODES as readonly string[]).includes(asked ?? '') ? (asked as PlayMode) : null;
  return {
    mode,
    freezeStrikeMs: nonNegative(params.get('freeze'), 10_000),
    songMs: mode === 'beat' ? nonNegative(params.get('song'), 600_000) : null,
  };
}
