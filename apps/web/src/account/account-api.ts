/**
 * The typed client of the app's own server (same origin, session cookie): who is signed in, sync, delete everything,
 * sign out, and the quiet hour. Never throws: every call answers `ApiResult`, with the failure sorted into a few kinds
 * the callers act on. Never logs: bodies carry names and journal notes.
 *
 * Sorting rule: the server always answers JSON (`{ error: code }` on failure), so a 5xx without a JSON body comes from
 * something in front of it (the dev proxy with no server running, nginx while the server is down, Cloudflare) and
 * counts as `offline`, like a failed fetch.
 */
import {
  type MeResponse,
  type QuietHourBeatsInput,
  type QuietHourStatus,
  type SyncRequest,
  type SyncResponse,
  isRecord,
  parseSyncResponse,
} from '@chuanho/contract';
import { parseQuietHourStatus } from '../quiet-hour/quiet-hour-status';

export type ApiError =
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'conflict'; readonly code: string }
  | { readonly kind: 'offline' }
  | { readonly kind: 'server'; readonly status: number }
  | { readonly kind: 'invalid' };

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

export interface AccountApi {
  me(): Promise<ApiResult<MeResponse>>;
  sync(request: SyncRequest): Promise<ApiResult<SyncResponse>>;
  deleteAllData(): Promise<ApiResult<null>>;
  signOut(): Promise<ApiResult<null>>;
  quietHourStatus(): Promise<ApiResult<QuietHourStatus>>;
  sendQuietHourBeats(input: QuietHourBeatsInput): Promise<ApiResult<QuietHourStatus>>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 15_000;
const NAME_MAX = 80;

const fail = (error: ApiError): ApiResult<never> => ({ ok: false, error });

export function parseMeResponse(raw: unknown): MeResponse | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '' || typeof raw.name !== 'string') return null;
  return { id: raw.id, name: raw.name.trim().slice(0, NAME_MAX) };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** The failure kind of a non-2xx response (see the sorting rule in the header). */
function errorOf(status: number, body: unknown): ApiError {
  if (status === 401) return { kind: 'unauthorized' };
  if (status === 409) return { kind: 'conflict', code: isRecord(body) && typeof body.error === 'string' ? body.error : '' };
  if (status >= 500 && body === undefined) return { kind: 'offline' };
  return { kind: 'server', status };
}

/** Sorts a finished response whose 2xx body `parse` reads. */
export async function readResult<T>(response: Response, parse: (raw: unknown) => T | null): Promise<ApiResult<T>> {
  const body = await readJson(response);
  if (!response.ok) return fail(errorOf(response.status, body));
  const value = parse(body);
  return value === null ? fail({ kind: 'invalid' }) : { ok: true, value };
}

/** Sorts a finished response of a call that answers 204 with no body. */
export async function emptyResult(response: Response): Promise<ApiResult<null>> {
  return response.ok ? { ok: true, value: null } : fail(errorOf(response.status, await readJson(response)));
}

export function createAccountApi(fetcher: FetchLike = (input, init) => fetch(input, init)): AccountApi {
  async function send(path: string, init: RequestInit): Promise<Response | null> {
    try {
      return await fetcher(path, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        ...init,
        headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      });
    } catch {
      return null;
    }
  }

  async function call<T>(path: string, init: RequestInit, parse: (raw: unknown) => T | null): Promise<ApiResult<T>> {
    const response = await send(path, init);
    return response ? readResult(response, parse) : fail({ kind: 'offline' });
  }

  async function callEmpty(path: string, method: string): Promise<ApiResult<null>> {
    const response = await send(path, { method });
    return response ? emptyResult(response) : fail({ kind: 'offline' });
  }

  return {
    me: () => call('/api/me', { method: 'GET' }, parseMeResponse),
    sync: (request) => call('/api/sync', { method: 'POST', body: JSON.stringify(request) }, parseSyncResponse),
    deleteAllData: () => callEmpty('/api/me/data', 'DELETE'),
    signOut: () => callEmpty('/auth/logout', 'POST'),
    quietHourStatus: () => call('/api/quiet-hour', { method: 'GET' }, parseQuietHourStatus),
    sendQuietHourBeats: (input) => call('/api/quiet-hour/beats', { method: 'POST', body: JSON.stringify(input) }, parseQuietHourStatus),
  };
}

/** Where the one-tap sign-in goes: the server's start of sign-in, coming back to the same page in the same language. */
export function signInHref(returnPath: string, locale: string): string {
  const safe = returnPath.startsWith('/') && !returnPath.startsWith('//') && returnPath.length <= 200 ? returnPath : '/';
  return `/auth/login?${new URLSearchParams({ return: safe, lang: locale === 'en' ? 'en' : 'vi' }).toString()}`;
}

/** The app's one client. */
export const accountApi: AccountApi = createAccountApi();
