/**
 * The room API client: one small `fetchJson` that never throws (network failures, 401, 429 and the room's own
 * refusals all come back as a typed `RoomApiError`), and one function per endpoint. Answers are checked for shape
 * before the screen trusts them. Kept apart from the account client on purpose: the room handles its own sign-in state.
 */
import {
  type MeResponse,
  type RoomCreateInput,
  type RoomErrorCode,
  type RoomSnapshot,
  type WishRejection,
  isRecord,
  isRoomErrorCode,
} from '@chuanho/contract';

export type RoomApiError =
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'server'; readonly status: number }
  | { readonly kind: 'room'; readonly code: RoomErrorCode; readonly reason?: WishRejection };

export type RoomApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RoomApiError };

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const WISH_REASONS: readonly string[] = ['empty', 'tooLong', 'phone', 'link', 'email', 'money', 'rude'];

/** A whole snapshot as the server sends it (checked on the fields the screen reads). */
export function isRoomSnapshot(value: unknown): value is RoomSnapshot {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.theme === 'string' &&
    typeof value.burnMinutes === 'number' &&
    typeof value.hostId === 'string' &&
    typeof value.locked === 'boolean' &&
    (value.status === 'open' || value.status === 'ashes') &&
    Array.isArray(value.members) &&
    value.members.every((member) => isRecord(member) && typeof member.id === 'string' && typeof member.name === 'string') &&
    Array.isArray(value.wishes) &&
    value.wishes.every((wish) => isRecord(wish) && typeof wish.id === 'string' && typeof wish.text === 'string') &&
    typeof value.litTotal === 'number' &&
    typeof value.meId === 'string' &&
    typeof value.serverNow === 'number'
  );
}

const isMe = (value: unknown): value is MeResponse => isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string';

/** The error an answer that is not 2xx stands for. */
function errorOf(status: number, body: unknown): RoomApiError {
  if (status === 401) return { kind: 'signed-out' };
  if (isRecord(body) && isRoomErrorCode(body.error)) {
    const reason = typeof body.reason === 'string' && WISH_REASONS.includes(body.reason) ? (body.reason as WishRejection) : undefined;
    return reason ? { kind: 'room', code: body.error, reason } : { kind: 'room', code: body.error };
  }
  if (status === 429) return { kind: 'rate-limited' };
  return { kind: 'server', status };
}

/** Calls the API; `accept` checks a 2xx body (204 passes `undefined`). Never throws. */
export async function fetchJson<T>(fetcher: Fetcher, path: string, init: RequestInit, accept: (body: unknown) => body is T): Promise<RoomApiResult<T>> {
  let response: Response;
  try {
    response = await fetcher(path, { ...init, credentials: 'same-origin', headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) } });
  } catch (error) {
    console.warn('Room request failed', path, error);
    return { ok: false, error: { kind: 'offline' } };
  }
  let body: unknown = undefined;
  if (response.status !== 204) {
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
  }
  if (!response.ok) return { ok: false, error: errorOf(response.status, body) };
  return accept(body) ? { ok: true, value: body } : { ok: false, error: { kind: 'server', status: response.status } };
}

const nothing = (_body: unknown): _body is undefined => true;
const base = (code: string): string => `/api/rooms/${encodeURIComponent(code)}`;
const post = (body?: unknown): RequestInit => ({ method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

type SnapshotCall = Promise<RoomApiResult<RoomSnapshot>>;

export interface RoomApi {
  me(): Promise<RoomApiResult<MeResponse>>;
  create(input: RoomCreateInput): SnapshotCall;
  get(code: string): SnapshotCall;
  join(code: string): SnapshotCall;
  leave(code: string): Promise<RoomApiResult<undefined>>;
  light(code: string): SnapshotCall;
  wish(code: string, text: string): SnapshotCall;
  deleteWish(code: string, wishId: string): SnapshotCall;
  report(code: string, wishId: string): SnapshotCall;
  lock(code: string, locked: boolean): SnapshotCall;
  /** Host only: removes another member (by their room id) from the room for good. */
  removeMember(code: string, memberId: string): SnapshotCall;
}

/** The endpoints, bound to one fetch (the browser's by default, a fake in tests). */
export function roomApi(fetcher: Fetcher = (input, init) => fetch(input, init)): RoomApi {
  const snapshot = (path: string, init: RequestInit): SnapshotCall => fetchJson(fetcher, path, init, isRoomSnapshot);
  const wishPath = (code: string, wishId: string): string => `${base(code)}/wishes/${encodeURIComponent(wishId)}`;
  return {
    me: () => fetchJson(fetcher, '/api/me', { method: 'GET' }, isMe),
    create: (input) => snapshot('/api/rooms', post(input)),
    get: (code) => snapshot(base(code), { method: 'GET' }),
    join: (code) => snapshot(`${base(code)}/join`, post()),
    leave: (code) => fetchJson(fetcher, `${base(code)}/leave`, post(), nothing),
    light: (code) => snapshot(`${base(code)}/light`, post()),
    wish: (code, text) => snapshot(`${base(code)}/wishes`, post({ text })),
    deleteWish: (code, wishId) => snapshot(wishPath(code, wishId), { method: 'DELETE' }),
    report: (code, wishId) => snapshot(`${wishPath(code, wishId)}/report`, post()),
    lock: (code, locked) => snapshot(`${base(code)}/lock`, post({ locked })),
    removeMember: (code, memberId) => snapshot(`${base(code)}/members/${encodeURIComponent(memberId)}/remove`, post()),
  };
}

/** The address of the room's event stream. */
export const roomEventsPath = (code: string): string => `${base(code)}/events`;
