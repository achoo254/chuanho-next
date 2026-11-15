/**
 * One open room on this device: joins it (joining again is just coming back), follows it live (room-live.ts), keeps
 * the newest snapshot (room-session-state.ts), ticks a clock on the server's time so sticks burn between updates, and
 * offers the actions. Each action applies its own answer at once instead of waiting for the pushed copy, and resolves
 * to the error it met (or null) so the screen can say what went wrong.
 */
import type { RoomSnapshot } from '@chuanho/contract';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { type RoomApi, type RoomApiError, type RoomApiResult, roomEventsPath } from './room-api';
import { browserLiveDeps, connectRoomLive } from './room-live';
import { INITIAL_ROOM_SESSION, type RoomSessionState, roomSessionReducer } from './room-session-state';

/** Sticks are counted down in minutes; a few seconds between redraws is plenty. */
const TICK_MS = 5_000;

export interface RoomActions {
  light(): Promise<RoomApiError | null>;
  wish(text: string): Promise<RoomApiError | null>;
  deleteWish(wishId: string): Promise<RoomApiError | null>;
  report(wishId: string): Promise<RoomApiError | null>;
  setLocked(locked: boolean): Promise<RoomApiError | null>;
  /** Host only: removes another member from the room for good. */
  removeMember(memberId: string): Promise<RoomApiError | null>;
  leave(): Promise<RoomApiError | null>;
}

export interface RoomSession {
  readonly state: RoomSessionState;
  /** The server's time now, as best this device knows it. */
  readonly serverNow: number;
  /** Server clock minus device clock, for anything that redraws more often than the shared tick. */
  readonly offset: number;
  readonly actions: RoomActions;
}

export function useRoomSession(code: string, api: RoomApi): RoomSession {
  const [state, dispatch] = useReducer(roomSessionReducer, INITIAL_ROOM_SESSION);
  const [deviceNow, setDeviceNow] = useState(() => Date.now());

  const accept = useCallback((snapshot: RoomSnapshot) => dispatch({ type: 'snapshot', snapshot, receivedAt: Date.now() }), []);

  useEffect(() => {
    let active = true;
    let stopLive: (() => void) | null = null;
    void api.join(code).then((result) => {
      if (!active) return;
      if (!result.ok) {
        dispatch({ type: 'failed', error: result.error });
        return;
      }
      accept(result.value);
      stopLive = connectRoomLive(
        {
          onSnapshot: accept,
          onMode: (mode) => dispatch({ type: 'mode', mode }),
          onGone: (error) => dispatch({ type: 'gone', error }),
        },
        browserLiveDeps(roomEventsPath(code), () => api.get(code)),
      );
    });
    return () => {
      active = false;
      stopLive?.();
    };
  }, [api, code, accept]);

  useEffect(() => {
    const timer = window.setInterval(() => setDeviceNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const run = useCallback(
    async (call: Promise<RoomApiResult<RoomSnapshot>>): Promise<RoomApiError | null> => {
      const result = await call;
      if (!result.ok) return result.error;
      accept(result.value);
      return null;
    },
    [accept],
  );

  const light = useCallback(() => run(api.light(code)), [run, api, code]);
  const wish = useCallback((text: string) => run(api.wish(code, text)), [run, api, code]);
  const deleteWish = useCallback((wishId: string) => run(api.deleteWish(code, wishId)), [run, api, code]);
  const report = useCallback((wishId: string) => run(api.report(code, wishId)), [run, api, code]);
  const setLocked = useCallback((locked: boolean) => run(api.lock(code, locked)), [run, api, code]);
  const removeMember = useCallback((memberId: string) => run(api.removeMember(code, memberId)), [run, api, code]);
  const leave = useCallback(async () => {
    const result = await api.leave(code);
    return result.ok ? null : result.error;
  }, [api, code]);

  const offset = state.phase === 'live' || state.phase === 'gone' ? state.offset : 0;
  return { state, serverNow: deviceNow + offset, offset, actions: { light, wish, deleteWish, report, setLocked, removeMember, leave } };
}
