import { EMPTY_PROGRESS } from '@chuanho/contract';
import { describe, expect, it, vi } from 'vitest';
import { createAccountApi, parseMeResponse, signInHref } from './account-api';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function apiAnswering(response: Response | Error) {
  const fetcher = vi.fn(async (_input: string, _init: RequestInit): Promise<Response> => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { api: createAccountApi(fetcher), fetcher };
}

describe('account api', () => {
  it('reads the signed-in account with the session cookie', async () => {
    const { api, fetcher } = apiAnswering(json(200, { id: 'u1', name: ' Lan ' }));
    expect(await api.me()).toEqual({ ok: true, value: { id: 'u1', name: 'Lan' } });
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/me');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('sorts failures into kinds', async () => {
    expect(await apiAnswering(json(401, { error: 'sign-in-required' })).api.me()).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(await apiAnswering(new Error('network down')).api.me()).toEqual({ ok: false, error: { kind: 'offline' } });
    // A 5xx without JSON is something in front of the server (dev proxy, nginx), not the server itself.
    expect(await apiAnswering(new Response('', { status: 500 })).api.me()).toEqual({ ok: false, error: { kind: 'offline' } });
    expect(await apiAnswering(new Response('<html>bad gateway</html>', { status: 502 })).api.me()).toEqual({ ok: false, error: { kind: 'offline' } });
    expect(await apiAnswering(json(500, { error: 'internal' })).api.me()).toEqual({ ok: false, error: { kind: 'server', status: 500 } });
    expect(await apiAnswering(json(200, { name: 'no id' })).api.me()).toEqual({ ok: false, error: { kind: 'invalid' } });
  });

  it('posts a sync and reads the answer with the contract parser', async () => {
    const { api, fetcher } = apiAnswering(json(200, { progress: EMPTY_PROGRESS, journal: [{ id: 'bad' }], cursor: 3 }));
    const result = await api.sync({ progress: EMPTY_PROGRESS, journal: [], cursor: 0 });
    expect(result).toEqual({ ok: true, value: { progress: EMPTY_PROGRESS, journal: [], cursor: 3 } });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('reports a full journal as a conflict with its code', async () => {
    const result = await apiAnswering(json(409, { error: 'journal-full' })).api.sync({ progress: EMPTY_PROGRESS, journal: [], cursor: 0 });
    expect(result).toEqual({ ok: false, error: { kind: 'conflict', code: 'journal-full' } });
  });

  it('accepts the empty 204 answers of delete and sign-out', async () => {
    expect(await apiAnswering(new Response(null, { status: 204 })).api.deleteAllData()).toEqual({ ok: true, value: null });
    const { api, fetcher } = apiAnswering(new Response(null, { status: 204 }));
    expect(await api.signOut()).toEqual({ ok: true, value: null });
    expect(fetcher.mock.calls[0]?.slice(0, 1)).toEqual(['/auth/logout']);
    expect(await apiAnswering(json(403, { error: 'forbidden-origin' })).api.signOut()).toEqual({ ok: false, error: { kind: 'server', status: 403 } });
  });

  it('reads the quiet hour status and rejects a malformed one', async () => {
    const status = { day: '2027-01-15', open: true, startsAt: 1_800_000_000_000, endsAt: 1_800_001_800_000, total: 12, milestones: [], serverNow: 1_800_000_100_000 };
    expect(await apiAnswering(json(200, status)).api.quietHourStatus()).toEqual({ ok: true, value: status });
    expect(await apiAnswering(json(200, { ...status, total: -1 })).api.quietHourStatus()).toEqual({ ok: false, error: { kind: 'invalid' } });
    expect(await apiAnswering(json(409, { error: 'quiet-hour-closed' })).api.sendQuietHourBeats({ day: '2027-01-15', count: 3 })).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'quiet-hour-closed' },
    });
  });
});

describe('parseMeResponse', () => {
  it('needs an id and a string name (empty allowed)', () => {
    expect(parseMeResponse({ id: 'u1', name: '' })).toEqual({ id: 'u1', name: '' });
    expect(parseMeResponse({ id: '', name: 'x' })).toBeNull();
    expect(parseMeResponse({ id: 'u1' })).toBeNull();
  });
});

describe('signInHref', () => {
  it('returns to the same page in the same language', () => {
    expect(signInHref('/?light=lanternNight', 'en')).toBe('/auth/login?return=%2F%3Flight%3DlanternNight&lang=en');
    expect(signInHref('//evil.example', 'vi')).toBe('/auth/login?return=%2F&lang=vi');
  });
});
