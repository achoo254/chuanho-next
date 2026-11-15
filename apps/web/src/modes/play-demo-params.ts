/**
 * Address parameters that put the 3D game straight into a state, for screenshots and quick checks on a device:
 *
 * - `play=<mode>` opens that play mode at once (no Start screen; sound unlocks on the first tap as usual).
 * - `freeze=<ms>` holds the strike at that many ms after the touch (45 = the hit), the character mid-swing.
 * - `song=<ms>` (with `play=beat`) shows a Mõ Beat song stopped at that time, earlier notes already hit.
 * - `play=room-game` opens the shared room's entry cutscene and then its "Hộ hương" minigame as practice, with no
 *   server or sign-in (a preview: nothing is sent, only the local best score is kept).
 *
 * Nothing here changes saved progress. Without these parameters the game starts on its Start screen as normal.
 */
import { PLAY_MODES, type PlayMode } from './play-mode-routing';

export interface PlayDemoParams {
  readonly mode: PlayMode | null;
  readonly freezeStrikeMs: number | null;
  readonly songMs: number | null;
  /** The shared room's minigame preview (`play=room-game`), which opens the room mode. */
  readonly roomGame: boolean;
}

const ROOM_GAME = 'room-game';

function nonNegative(raw: string | null, max: number): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

export function playDemoParams(search: string): PlayDemoParams {
  const params = new URLSearchParams(search);
  const asked = params.get('play');
  const roomGame = asked === ROOM_GAME;
  const mode = roomGame ? 'room' : (PLAY_MODES as readonly string[]).includes(asked ?? '') ? (asked as PlayMode) : null;
  return {
    mode,
    freezeStrikeMs: nonNegative(params.get('freeze'), 10_000),
    songMs: mode === 'beat' ? nonNegative(params.get('song'), 600_000) : null,
    roomGame,
  };
}
