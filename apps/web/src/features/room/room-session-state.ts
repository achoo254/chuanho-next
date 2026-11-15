/**
 * The state of one open room on this device, as a reducer: joining, then live with the newest snapshot (answers to
 * our own actions and pushed events can cross, so an older snapshot never replaces a newer one), and how the live
 * link is doing; or failed to get in, or gone (the room closed while we were in it, the last snapshot kept for the
 * ashes card).
 */
import type { RoomSnapshot } from '@chuanho/contract';
import type { RoomApiError } from './room-api';
import type { LiveMode } from './room-live';
import { clockOffset } from './room-view-model';

export type RoomSessionState =
  | { readonly phase: 'joining' }
  | { readonly phase: 'failed'; readonly error: RoomApiError }
  | { readonly phase: 'live'; readonly snapshot: RoomSnapshot; readonly offset: number; readonly mode: LiveMode }
  | { readonly phase: 'gone'; readonly snapshot: RoomSnapshot | null; readonly offset: number; readonly error: RoomApiError | null };

export type RoomSessionAction =
  | { readonly type: 'snapshot'; readonly snapshot: RoomSnapshot; readonly receivedAt: number }
  | { readonly type: 'mode'; readonly mode: LiveMode }
  | { readonly type: 'failed'; readonly error: RoomApiError }
  | { readonly type: 'gone'; readonly error: RoomApiError | null };

export const INITIAL_ROOM_SESSION: RoomSessionState = { phase: 'joining' };

export function roomSessionReducer(state: RoomSessionState, action: RoomSessionAction): RoomSessionState {
  switch (action.type) {
    case 'snapshot': {
      if (state.phase === 'gone' || state.phase === 'failed') return state;
      const offset = clockOffset(action.snapshot, action.receivedAt);
      if (state.phase === 'joining') return { phase: 'live', snapshot: action.snapshot, offset, mode: 'connecting' };
      if (action.snapshot.serverNow < state.snapshot.serverNow) return state;
      return { ...state, snapshot: action.snapshot, offset };
    }
    case 'mode':
      return state.phase === 'live' && state.mode !== action.mode ? { ...state, mode: action.mode } : state;
    case 'failed':
      return state.phase === 'joining' ? { phase: 'failed', error: action.error } : state;
    case 'gone':
      if (state.phase === 'live') return { phase: 'gone', snapshot: state.snapshot, offset: state.offset, error: action.error };
      return state.phase === 'joining' ? { phase: 'gone', snapshot: null, offset: 0, error: action.error } : state;
  }
}
