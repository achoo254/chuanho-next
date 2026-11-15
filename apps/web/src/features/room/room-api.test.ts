import type { RoomSnapshot } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { type Fetcher, roomApi } from './room-api';
import { inviteCodeIn, inviteLink, normaliseRoomCode, searchWithoutInvite, signInHref } from './room-invite';

const SNAPSHOT: RoomSnapshot = {
  code: 'ABC234',
  name: 'Phòng',
  theme: 'exam',
  burnMinutes: 30,
  hostId: 'm1',
  locked: false,
  status: 'open',
  members: [{ id: 'm1', name: 'An', stick: null }],
  wishes: [],
  litTotal: 0,
  meId: 'm1',
  myReportedWishId: null,
  serverNow: 1000,
};

/** A fetch that answers once with `status` and `body`, recording the call. */
function fakeFetch(status: number, body?: unknown): { fetcher: Fetcher; calls: { path: string; init: RequestInit | undefined }[] } {
  const calls: { path: string; init: RequestInit | undefined }[] = [];
  const fetcher: Fetcher = (path, init) => {
    calls.push({ path, init });
    return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  };
  return { fetcher, calls };
}

describe('roomApi', () => {
  it('posts JSON to the room endpoints and checks the snapshot it gets back', async () => {
    const { fetcher, calls } = fakeFetch(201, SNAPSHOT);
    const result = await roomApi(fetcher).wish('ABC234', 'Qua môn');
    expect(result).toEqual({ ok: true, value: SNAPSHOT });
    expect(calls[0]?.path).toBe('/api/rooms/ABC234/wishes');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ text: 'Qua môn' }));
    expect(calls[0]?.init?.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('turns refusals, sign-out, rate limits, bad bodies and network failures into typed errors', async () => {
    expect(await roomApi(fakeFetch(422, { error: 'wish-rejected', reason: 'link' }).fetcher).wish('ABC234', 'x')).toEqual({
      ok: false,
      error: { kind: 'room', code: 'wish-rejected', reason: 'link' },
    });
    expect(await roomApi(fakeFetch(401, { error: 'sign-in-required' }).fetcher).me()).toEqual({ ok: false, error: { kind: 'signed-out' } });
    expect(await roomApi(fakeFetch(429, { error: 'rate-limited' }).fetcher).light('ABC234')).toEqual({ ok: false, error: { kind: 'rate-limited' } });
    expect(await roomApi(fakeFetch(200, { nope: true }).fetcher).get('ABC234')).toEqual({ ok: false, error: { kind: 'server', status: 200 } });
    const offline: Fetcher = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await roomApi(offline).join('ABC234')).toEqual({ ok: false, error: { kind: 'offline' } });
    expect(await roomApi(fakeFetch(204).fetcher).leave('ABC234')).toEqual({ ok: true, value: undefined });
    expect(await roomApi(fakeFetch(403, { error: 'removed' }).fetcher).join('ABC234')).toEqual({ ok: false, error: { kind: 'room', code: 'removed' } });
  });

  it('asks the server to remove a member by their room id', async () => {
    const { fetcher, calls } = fakeFetch(200, SNAPSHOT);
    expect(await roomApi(fetcher).removeMember('ABC234', 'm 2/x')).toEqual({ ok: true, value: SNAPSHOT });
    expect(calls[0]?.path).toBe('/api/rooms/ABC234/members/m%202%2Fx/remove');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(await roomApi(fakeFetch(409, { error: 'cannot-remove-self' }).fetcher).removeMember('ABC234', 'm1')).toEqual({
      ok: false,
      error: { kind: 'room', code: 'cannot-remove-self' },
    });
  });
});

describe('room invite', () => {
  it('builds the invite and sign-in addresses back to the room', () => {
    expect(inviteLink('https://example.test', 'ABC234')).toBe('https://example.test/?play=room&room=ABC234');
    expect(signInHref('ABC234')).toBe(`/auth/login?return=${encodeURIComponent('/?play=room&room=ABC234')}`);
    expect(signInHref(null)).toBe(`/auth/login?return=${encodeURIComponent('/?play=room')}`);
  });

  it('reads a code from the address and takes it off again', () => {
    expect(inviteCodeIn('?play=room&room=abc234')).toBe('ABC234');
    expect(inviteCodeIn('?room=ABC0I1')).toBeNull();
    expect(inviteCodeIn('?play=yard')).toBeNull();
    expect(searchWithoutInvite('?play=room&room=ABC234')).toBe('');
    expect(searchWithoutInvite('?play=room&room=ABC234&light=sunset')).toBe('?light=sunset');
    expect(searchWithoutInvite('?play=yard&room=ABC234')).toBe('?play=yard');
  });

  it('accepts a typed code with spaces or dashes', () => {
    expect(normaliseRoomCode(' abc-234 ')).toBe('ABC234');
    expect(normaliseRoomCode('abc')).toBeNull();
  });
});
