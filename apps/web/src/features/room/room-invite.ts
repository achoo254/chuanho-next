/**
 * The room's address: an invite link opens the game straight in the room screen (`?play=room`) with the code
 * (`&room=CODE`); the screen reads the code once and takes it off the address bar, so a reload or a shared screenshot
 * of the address does not carry it on. Signing in returns to the same address.
 */
import { isRoomCode } from '@chuanho/contract';

const ROOM_PARAM = 'room';
const PLAY_PARAM = 'play';

/** The address that opens the room screen, with the code when there is one. */
export function roomPath(code: string | null): string {
  return code ? `/?${PLAY_PARAM}=room&${ROOM_PARAM}=${code}` : `/?${PLAY_PARAM}=room`;
}

export const inviteLink = (origin: string, code: string): string => `${origin}${roomPath(code)}`;

/** Sign-in that comes back to the room screen (and the room, when known). */
export const signInHref = (code: string | null): string => `/auth/login?return=${encodeURIComponent(roomPath(code))}`;

/** A room code typed or pasted by hand: spaces and dashes dropped, upper-cased; null when it cannot be a code. */
export function normaliseRoomCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/g, '').toUpperCase();
  return isRoomCode(code) ? code : null;
}

/** The invite code in a query string, or null. */
export function inviteCodeIn(search: string): string | null {
  const raw = new URLSearchParams(search).get(ROOM_PARAM);
  return raw === null ? null : normaliseRoomCode(raw);
}

/** The query string without the invite (and without `play=room`, so a reload lands in the yard as usual). */
export function searchWithoutInvite(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(ROOM_PARAM);
  if (params.get(PLAY_PARAM) === 'room') params.delete(PLAY_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : '';
}

/** Reads the invite code of the current address once and takes it off the address bar. */
export function takeInviteCode(): string | null {
  const { pathname, search, hash } = window.location;
  const code = inviteCodeIn(search);
  const cleaned = searchWithoutInvite(search);
  if (cleaned !== search) window.history.replaceState(window.history.state, '', `${pathname}${cleaned}${hash}`);
  return code;
}
