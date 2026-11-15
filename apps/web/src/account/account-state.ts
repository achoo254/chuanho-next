/**
 * Who is playing, as the web sees it, and how each answer of GET /api/me moves that. Pure.
 *
 * Signing in is optional, so anything short of a clear "this account" leaves a guest who plays as before: no server
 * (dev without the API, the API down) is a guest, not an error screen. A signed-in player stays signed in through a
 * network blip; only the server saying "not signed in" (401) makes them a guest again.
 */
import type { MeResponse } from '@chuanho/contract';
import type { ApiResult } from './account-api';

export type AccountStatus = 'loading' | 'guest' | 'signedIn' | 'error';

export type AccountState =
  | { readonly status: 'loading' }
  | { readonly status: 'guest' }
  | { readonly status: 'error' }
  | { readonly status: 'signedIn'; readonly user: MeResponse };

export const LOADING: AccountState = { status: 'loading' };
export const GUEST: AccountState = { status: 'guest' };

/** The state after an answer of GET /api/me; answers `previous` itself when nothing changed. */
export function nextAccountState(previous: AccountState, result: ApiResult<MeResponse>): AccountState {
  if (result.ok) {
    const same = previous.status === 'signedIn' && previous.user.id === result.value.id && previous.user.name === result.value.name;
    return same ? previous : { status: 'signedIn', user: result.value };
  }
  if (result.error.kind === 'unauthorized') return previous.status === 'guest' ? previous : GUEST;
  if (previous.status === 'signedIn') return previous;
  if (result.error.kind === 'offline') return previous.status === 'guest' ? previous : GUEST;
  return previous.status === 'error' ? previous : { status: 'error' };
}

/** Re-checks on focus come at most this often (focus and visibility often fire together). */
export const RECHECK_MIN_GAP_MS = 15_000;

export const shouldRecheck = (lastCheckAt: number, now: number): boolean => now - lastCheckAt >= RECHECK_MIN_GAP_MS;

/** The letter on the account chip: the first letter of the display name, or null (the chip shows a person icon). */
export function nameInitial(name: string): string | null {
  const first = [...name.trim()][0];
  return first === undefined ? null : first.toLocaleUpperCase('vi');
}
