/** The shared incense room through the HTTP API and its event stream, with two accounts from the fake IdP. */
import type { RoomSnapshot } from '@chuanho/contract';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type FakeIdp, startFakeIdp } from '../../test/fake-idp';
import { api, signIn } from '../../test/sign-in';
import { type TestServer, startTestServer } from '../../test/test-server';
import { newRoomCode } from './room-routes';

const SECRET = 'test-secret-'.padEnd(40, 'x');

let idp: FakeIdp;
let server: TestServer;
let host: string;
let guest: string;

beforeAll(async () => {
  idp = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'room-host', profile: { name: 'Nguyễn Văn An' } });
  server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
  host = await signIn(server);
  idp.setSub('room-guest');
  idp.setProfile({ name: 'Trần Bình' });
  guest = await signIn(server);
});
afterAll(async () => {
  await server.close();
  await idp.close();
});

const post = (path: string, cookie: string, body?: unknown): Promise<Response> =>
  api(server, path, { method: 'POST', cookie, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function snapshotOf(res: Response, status = 200): Promise<RoomSnapshot> {
  expect(res.status).toBe(status);
  return (await res.json()) as RoomSnapshot;
}

/** Rooms made by a test; everyone leaves them afterwards, so the host stays under the open-room limit. */
const made: string[] = [];
afterEach(async () => {
  for (const code of made.splice(0)) for (const cookie of [guest, host]) await post(`/api/rooms/${code}/leave`, cookie);
});

async function createRoom(): Promise<RoomSnapshot> {
  const room = await snapshotOf(await post('/api/rooms', host, { name: 'Giải nghiệp phòng PTPM', theme: 'deadline' }), 201);
  made.push(room.code);
  return room;
}

/** Reads server-sent events from a stream until `count` snapshots (or a `closed` event) arrived. */
async function readEvents(body: ReadableStream<Uint8Array>, count: number): Promise<{ snapshots: RoomSnapshot[]; closed: boolean }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const snapshots: RoomSnapshot[] = [];
  let buffer = '';
  let closed = false;
  while (snapshots.length < count && !closed) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end = buffer.indexOf('\n\n');
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (block.startsWith('event: closed')) closed = true;
      else if (block.startsWith('data: ')) snapshots.push(JSON.parse(block.slice(6)) as RoomSnapshot);
      end = buffer.indexOf('\n\n');
    }
  }
  reader.releaseLock();
  return { snapshots, closed };
}

describe('room routes', () => {
  it('make codes from the safe alphabet', () => {
    expect(newRoomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('need a session and a valid body', async () => {
    expect((await post('/api/rooms', '', { name: 'x', theme: 'deadline' })).status).toBe(401);
    expect(await (await post('/api/rooms', host, { name: '', theme: 'deadline' })).json()).toEqual({ error: 'invalid-body' });
    expect((await post('/api/rooms', host, { name: 'x', theme: 'party' })).status).toBe(400);
  });

  it('let a friend join by code and see the host with short names only', async () => {
    const room = await createRoom();
    expect(room.members.map((m) => m.name)).toEqual(['An']);
    expect((await api(server, `/api/rooms/${room.code}`, { cookie: guest })).status).toBe(403);
    const joined = await snapshotOf(await post(`/api/rooms/${room.code.toLowerCase()}/join`, guest));
    expect(joined.members.map((m) => m.name)).toEqual(['An', 'Bình']);
    expect(JSON.stringify(joined)).not.toContain('room-host');
    expect(await (await post('/api/rooms/ZZZZZZ/join', guest)).json()).toEqual({ error: 'room-not-found' });
  });

  it('refuse a filtered wish with its reason and keep only the host in charge', async () => {
    const room = await createRoom();
    await post(`/api/rooms/${room.code}/join`, guest);
    const rejected = await post(`/api/rooms/${room.code}/wishes`, guest, { text: 'ib zalo 0912345678' });
    expect(rejected.status).toBe(422);
    expect(await rejected.json()).toEqual({ error: 'wish-rejected', reason: 'phone' });
    const wished = await snapshotOf(await post(`/api/rooms/${room.code}/wishes`, guest, { text: 'Cho sprint này êm' }), 201);
    const wish = wished.wishes[0];
    if (!wish) throw new Error('no wish');
    expect(await (await post(`/api/rooms/${room.code}/wishes/${wish.id}/report`, guest)).json()).toEqual({ error: 'own-wish' });
    expect((await snapshotOf(await post(`/api/rooms/${room.code}/wishes/${wish.id}/report`, host))).myReportedWishId).toBe(wish.id);
    expect((await post(`/api/rooms/${room.code}/lock`, guest)).status).toBe(403);
    expect((await snapshotOf(await post(`/api/rooms/${room.code}/lock`, host, { locked: true }))).locked).toBe(true);
    const deleted = await snapshotOf(await api(server, `/api/rooms/${room.code}/wishes/${wish.id}`, { method: 'DELETE', cookie: host }));
    expect(deleted.wishes).toEqual([]);
    expect((await post(`/api/rooms/${room.code}/leave`, guest)).status).toBe(204);
    expect(await (await post(`/api/rooms/${room.code}/join`, guest)).json()).toEqual({ error: 'room-locked' });
  });

  it('push every change to open event streams, each with its own viewer', async () => {
    const room = await createRoom();
    const joined = await snapshotOf(await post(`/api/rooms/${room.code}/join`, guest));
    const abort = new AbortController();
    const stream = await fetch(`${server.origin}/api/rooms/${room.code}/events`, { headers: { cookie: guest }, signal: abort.signal });
    try {
      expect(stream.status).toBe(200);
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
      expect(stream.headers.get('x-accel-buffering')).toBe('no');
      if (!stream.body) throw new Error('no body');
      const reading = readEvents(stream.body, 2);
      await post(`/api/rooms/${room.code}/light`, host);
      const { snapshots } = await reading;
      expect(snapshots[0]?.meId).toBe(joined.meId);
      expect(snapshots[1]?.litTotal).toBe(1);
      expect(snapshots[1]?.meId).toBe(joined.meId);
    } finally {
      abort.abort();
    }
  });

  it('end the stream with a closed event when the viewer leaves', async () => {
    const room = await createRoom();
    await post(`/api/rooms/${room.code}/join`, guest);
    const abort = new AbortController();
    const stream = await fetch(`${server.origin}/api/rooms/${room.code}/events`, { headers: { cookie: guest }, signal: abort.signal });
    try {
      if (!stream.body) throw new Error('no body');
      const reading = readEvents(stream.body, 5);
      await post(`/api/rooms/${room.code}/leave`, guest);
      expect((await reading).closed).toBe(true);
    } finally {
      abort.abort();
    }
  });

  it('refuse a stream to someone outside the room', async () => {
    const room = await createRoom();
    const res = await fetch(`${server.origin}/api/rooms/${room.code}/events`, { headers: { cookie: guest } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not-member' });
  });
});
