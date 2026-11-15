/** The music library through the HTTP API, on an in-memory PGlite and a clock the test sets. */
import {
  LIBRARY_MAX_TRACKS,
  type LibraryIngestResponse,
  type LibraryManifest,
  type LibraryRemovedResponse,
  type LibraryTrack,
  type LibraryTracksResponse,
  vietnamDay,
} from '@chuanho/contract';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LibraryConfig } from '../config';
import { libraryListens, libraryTracks } from '../db/schema';
import { type TestServer, startTestServer } from '../../test/test-server';
import { listenerHash } from './library-access';
import { OVER_CAP_REASON } from './library-store';

const TOKEN = 'library-admin-token-'.padEnd(48, 'x');
const SALT = 'library-listen-salt-'.padEnd(48, 'y');
const DAY_MS = 86_400_000;
const T0 = Date.parse('2026-11-15T03:00:00Z');

let clock = T0;
const now = (): Date => new Date(clock);

const libraryConfig = (overrides: Partial<LibraryConfig> = {}): LibraryConfig => ({
  adminToken: TOKEN,
  listenSalt: SALT,
  listenLimitPerIp15Min: 1000,
  listenLimitGlobalPerMin: 1000,
  ...overrides,
});

const track = (n: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: `m${String(n).padStart(3, '0')}`,
  file: `m${String(n).padStart(3, '0')}-ab12.mp3`,
  duration: 120,
  tags: ['moon'],
  ...extra,
});

interface CallOptions {
  readonly body?: unknown;
  readonly token?: string | null;
  readonly ip?: string;
  readonly userAgent?: string;
}

/** A call as the app's own page or the operator's tooling makes it: the app's Origin, JSON, an optional Bearer token. */
function call(server: TestServer, method: string, path: string, { body, token, ip, userAgent }: CallOptions = {}): Promise<Response> {
  const headers = new Headers({ origin: server.origin });
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (ip) headers.set('x-forwarded-for', ip);
  if (userAgent) headers.set('user-agent', userAgent);
  return fetch(`${server.origin}${path}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return (await res.json()) as T;
}

const ingest = (server: TestServer, tracks: readonly Record<string, unknown>[]): Promise<Response> =>
  call(server, 'POST', '/api/library/ingest', { token: TOKEN, body: { tracks } });
const listen = (server: TestServer, trackId: string, ip = '203.0.113.7', userAgent = 'phone-a'): Promise<Response> =>
  call(server, 'POST', '/api/library/listen', { body: { trackId }, ip, userAgent });

describe('music library', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer({}, { now, overrides: { library: libraryConfig() } });
  });
  afterAll(async () => server.close());

  it('ingests by id, keeps listens and merges tags', async () => {
    const first = await json<LibraryIngestResponse>(await ingest(server, [track(1, { bpm: 68, playableBeatmap: true }), track(2)]));
    expect(first).toEqual({ added: 2, updated: 0, active: 2, pruned: [] });
    expect((await json<{ counted: boolean }>(await listen(server, 'm001'))).counted).toBe(true);

    clock = T0 + 1000;
    const again = await json<LibraryIngestResponse>(await ingest(server, [track(1, { file: 'm001-cd34.mp3', duration: 130, tags: ['rain'] }), track(3)]));
    expect(again).toEqual({ added: 1, updated: 1, active: 3, pruned: [] });
    const { tracks } = await json<LibraryTracksResponse>(await fetch(`${server.origin}/api/library/tracks`));
    expect(tracks.find((t) => t.id === 'm001')).toEqual({
      id: 'm001',
      file: 'm001-cd34.mp3',
      duration: 130,
      tags: ['moon', 'rain'],
      addedAt: T0,
      listens: 1,
      removed: false,
      bpm: 68,
      playableBeatmap: true,
    } satisfies LibraryTrack);
  });

  it('rejects a malformed ingest whole', async () => {
    expect((await ingest(server, [track(4), track(5, { file: '../x.mp3' })])).status).toBe(400);
    const { tracks } = await json<LibraryTracksResponse>(await fetch(`${server.origin}/api/library/tracks`));
    expect(tracks.map((t) => t.id)).toEqual(['m001', 'm002', 'm003']);
  });

  it('serves the manifest of live tracks, in the static manifest shape, and never caches it', async () => {
    const res = await fetch(`${server.origin}/api/library/manifest`);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    const manifest = await json<LibraryManifest>(res);
    expect(manifest.tracks[0]).toEqual({ id: 'm001', file: 'm001-cd34.mp3', duration: 130, tags: ['moon', 'rain'] });
  });

  it('takes a track down idempotently, keeps it down through a re-ingest, and puts it back', async () => {
    clock = T0 + 2000;
    const removed = await json<LibraryRemovedResponse['tracks'][number]>(
      await call(server, 'POST', '/api/library/tracks/m002/remove', { token: TOKEN, body: { reason: 'harsh hiss' } }),
    );
    expect(removed).toEqual({ id: 'm002', file: 'm002-ab12.mp3', reason: 'harsh hiss', removedAt: T0 + 2000 });
    clock = T0 + 3000;
    expect(await json(await call(server, 'POST', '/api/library/tracks/m002/remove', { token: TOKEN, body: { reason: 'again' } }))).toEqual(removed);
    expect((await call(server, 'POST', '/api/library/tracks/m002/remove', { token: TOKEN, body: { reason: ' ' } })).status).toBe(400);
    expect((await call(server, 'POST', '/api/library/tracks/nope/remove', { token: TOKEN, body: { reason: 'x' } })).status).toBe(404);

    await json(await ingest(server, [track(2)]));
    const manifest = await json<LibraryManifest>(await fetch(`${server.origin}/api/library/manifest`));
    expect(manifest.tracks.map((t) => t.id)).toEqual(['m001', 'm003']);
    expect((await listen(server, 'm002')).status).toBe(404);
    expect((await json<LibraryRemovedResponse>(await call(server, 'GET', '/api/library/removed', { token: TOKEN }))).tracks).toEqual([removed]);

    const restored = await json<LibraryTrack>(await call(server, 'POST', '/api/library/tracks/m002/restore', { token: TOKEN }));
    expect(restored).toMatchObject({ id: 'm002', removed: false });
    expect((await json<LibraryRemovedResponse>(await call(server, 'GET', '/api/library/removed', { token: TOKEN }))).tracks).toEqual([]);
    expect((await call(server, 'POST', '/api/library/tracks/nope/restore', { token: TOKEN })).status).toBe(404);
  });

  it('counts one listen per listener per track per day, and stores only a keyed hash', async () => {
    clock = T0 + 10_000;
    expect(await json(await listen(server, 'm003', '198.51.100.9', 'phone-b'))).toEqual({ counted: true });
    expect(await json(await listen(server, 'm003', '198.51.100.9', 'phone-b'))).toEqual({ counted: false });
    expect(await json(await listen(server, 'm003', '198.51.100.9', 'laptop-b'))).toEqual({ counted: true });
    expect(await json(await listen(server, 'm003', '198.51.100.10', 'phone-b'))).toEqual({ counted: true });
    clock = T0 + DAY_MS;
    expect(await json(await listen(server, 'm003', '198.51.100.9', 'phone-b'))).toEqual({ counted: true });

    const [row] = await server.database.db.select({ listens: libraryTracks.listens }).from(libraryTracks).where(eq(libraryTracks.id, 'm003'));
    expect(row?.listens).toBe(4);
    // The first listen of the new day dropped yesterday's hashes; what is left carries no IP or user agent.
    const rows = await server.database.db.select().from(libraryListens);
    const today = vietnamDay(clock);
    expect(rows).toEqual([{ trackId: 'm003', day: today, clientHash: listenerHash(SALT, today, '198.51.100.9', 'phone-b') }]);
    for (const stored of rows) {
      expect(stored.clientHash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(stored)).not.toMatch(/198\.51|phone/);
    }
  });

  it('rejects listens that are not a track id', async () => {
    expect((await call(server, 'POST', '/api/library/listen', { body: { trackId: '../x' } })).status).toBe(400);
    expect((await call(server, 'POST', '/api/library/listen', { body: { trackId: 'm999' } })).status).toBe(404);
  });

  it('guards the operator routes with the Bearer token', async () => {
    expect((await call(server, 'POST', '/api/library/ingest', { body: { tracks: [track(9)] } })).status).toBe(401);
    expect((await call(server, 'POST', '/api/library/ingest', { token: 'wrong', body: { tracks: [track(9)] } })).status).toBe(401);
    expect((await call(server, 'POST', '/api/library/ingest', { token: `${TOKEN}x`, body: { tracks: [track(9)] } })).status).toBe(401);
    expect((await call(server, 'GET', '/api/library/removed')).status).toBe(401);
    // Not callable from another site, whatever the token: the same-origin check runs first.
    const crossSite = await fetch(`${server.origin}/api/library/ingest`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ tracks: [track(9)] }),
    });
    expect(crossSite.status).toBe(403);
    const { tracks } = await json<LibraryTracksResponse>(await fetch(`${server.origin}/api/library/tracks`));
    expect(tracks.some((t) => t.id === 'm009')).toBe(false);
  });
});

describe('music library cap', () => {
  let server: TestServer;
  beforeAll(async () => {
    clock = T0;
    server = await startTestServer({}, { now, overrides: { library: libraryConfig() } });
  });
  afterAll(async () => server.close());

  it('takes down the least-heard, oldest tracks outside the ingest when it goes over the cap', async () => {
    const full = Array.from({ length: LIBRARY_MAX_TRACKS }, (_, i) => track(i + 1));
    expect(await json<LibraryIngestResponse>(await ingest(server, full))).toMatchObject({ added: LIBRARY_MAX_TRACKS, active: LIBRARY_MAX_TRACKS, pruned: [] });
    // m001 and m002 are heard; every other old track has no listens and the same age, so the lowest ids go first.
    await json(await listen(server, 'm001'));
    await json(await listen(server, 'm002'));

    clock = T0 + 5000;
    const result = await json<LibraryIngestResponse>(await ingest(server, [track(401), track(402), track(403)]));
    expect(result.added).toBe(3);
    expect(result.active).toBe(LIBRARY_MAX_TRACKS);
    expect(result.pruned).toEqual(['m003', 'm004', 'm005'].map((id) => ({ id, file: `${id}-ab12.mp3`, reason: OVER_CAP_REASON, removedAt: T0 + 5000 })));

    expect((await call(server, 'POST', '/api/library/tracks/m003/restore', { token: TOKEN })).status).toBe(409);
    const manifest = await json<LibraryManifest>(await fetch(`${server.origin}/api/library/manifest`));
    expect(manifest.tracks).toHaveLength(LIBRARY_MAX_TRACKS);
    expect(manifest.tracks.some((t) => t.id === 'm003')).toBe(false);
  });
});

describe('music library limits and switches', () => {
  it('answers 404 on every operator route while no token is configured', async () => {
    const server = await startTestServer({}, { now, overrides: { library: libraryConfig({ adminToken: null }) } });
    try {
      for (const [method, path] of [
        ['POST', '/api/library/ingest'],
        ['POST', '/api/library/tracks/m001/remove'],
        ['POST', '/api/library/tracks/m001/restore'],
        ['GET', '/api/library/removed'],
      ] as const) {
        const res = await call(server, method, path, { token: TOKEN, body: method === 'POST' ? { tracks: [track(1)], reason: 'x' } : undefined });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not-found' });
        expect(res.headers.get('ratelimit-policy')).toBeNull();
      }
      expect(await json(await fetch(`${server.origin}/api/library/manifest`))).toEqual({ tracks: [] });
    } finally {
      await server.close();
    }
  });

  it('rate-limits listens per IP and across the server', async () => {
    const perIp = await startTestServer({}, { now, overrides: { library: libraryConfig({ listenLimitPerIp15Min: 3 }) } });
    try {
      await json(await ingest(perIp, [track(1)]));
      for (let i = 0; i < 3; i += 1) expect((await listen(perIp, 'm001', '203.0.113.1', `ua-${i}`)).status).toBe(200);
      expect(await json(await listen(perIp, 'm001', '203.0.113.1', 'ua-x'), 429)).toEqual({ error: 'rate-limited' });
      expect((await listen(perIp, 'm001', '203.0.113.2', 'ua-x')).status).toBe(200);
    } finally {
      await perIp.close();
    }

    const global = await startTestServer({}, { now, overrides: { library: libraryConfig({ listenLimitGlobalPerMin: 2 }) } });
    try {
      await json(await ingest(global, [track(1)]));
      expect((await listen(global, 'm001', '203.0.113.1')).status).toBe(200);
      expect((await listen(global, 'm001', '203.0.113.2')).status).toBe(200);
      expect((await listen(global, 'm001', '203.0.113.3')).status).toBe(429);
    } finally {
      await global.close();
    }
  });
});
