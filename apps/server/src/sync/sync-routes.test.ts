/** POST /api/sync and DELETE /api/me/data through the HTTP API, with two "devices" sharing one account. */
import { EMPTY_PROGRESS, type JournalEntry, type ProgressDoc, type SyncResponse } from '@chuanho/contract';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type FakeIdp, startFakeIdp } from '../../test/fake-idp';
import { api, signIn } from '../../test/sign-in';
import { type TestServer, startTestServer } from '../../test/test-server';

const SECRET = 'test-secret-'.padEnd(40, 'x');

let idp: FakeIdp;
let server: TestServer;

beforeAll(async () => {
  idp = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'player-1', profile: { name: 'An' } });
  server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
});
afterAll(async () => {
  await server.close();
  await idp.close();
});

const entry = (id: string, updatedAt: number, change: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  day: '2026-11-15',
  kind: 'harsh',
  note: `ghi chú ${id}`,
  released: { reset: false, apology: false, deed: false },
  createdAt: 1_700_000_000_000,
  updatedAt,
  deletedAt: null,
  ...change,
});

const progressOf = (change: Partial<ProgressDoc>): ProgressDoc => ({ ...EMPTY_PROGRESS, ...change });

async function sync(session: string, body: { progress: ProgressDoc; journal: JournalEntry[]; cursor: number }): Promise<SyncResponse> {
  const res = await api(server, '/api/sync', { method: 'POST', cookie: session, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return (await res.json()) as SyncResponse;
}

/** A fresh account signed in on two browsers. */
async function twoDevices(sub: string): Promise<[string, string]> {
  idp.setSub(sub);
  return [await signIn(server), await signIn(server)];
}

describe('POST /api/sync', () => {
  it('takes the first upload of a device and returns it with a cursor', async () => {
    const [phone] = await twoDevices('first-upload');
    const progress = progressOf({ merit: 12, bestCombo: 30, moSkin: 'carved', updatedAt: 1_700_000_000_500 });
    const first = await sync(phone, { progress, journal: [entry('entry-0001', 10)], cursor: 0 });
    expect(first.progress).toEqual(progress);
    expect(first.journal).toEqual([entry('entry-0001', 10)]);
    expect(first.cursor).toBeGreaterThan(0);
    // Nothing changed since: an empty journal and the same cursor.
    const again = await sync(phone, { progress, journal: [], cursor: first.cursor });
    expect(again).toEqual({ progress, journal: [], cursor: first.cursor });
  });

  it('merges two devices: counters grow, newer edits win, deletions travel, the cursor returns only newer rows', async () => {
    const [phone, laptop] = await twoDevices('two-devices');
    const p1 = await sync(phone, {
      progress: progressOf({ merit: 10, restraintCount: 2, moSkin: 'fish', updatedAt: 2_000 }),
      journal: [entry('entry-keep', 100), entry('entry-edit', 100), entry('entry-gone', 100)],
      cursor: 0,
    });

    // The laptop has older progress, an older edit of one entry and a newer edit of another.
    const l1 = await sync(laptop, {
      progress: progressOf({ merit: 4, restraintCount: 5, moSkin: 'red', updatedAt: 1_000 }),
      journal: [entry('entry-keep', 50, { note: 'older edit' }), entry('entry-edit', 200, { released: { reset: true, apology: false, deed: false } })],
      cursor: 0,
    });
    expect(l1.progress).toMatchObject({ merit: 10, restraintCount: 5, moSkin: 'fish', updatedAt: 2_000 });
    const byId = new Map(l1.journal.map((e) => [e.id, e]));
    expect(byId.get('entry-keep')?.note).toBe('ghi chú entry-keep');
    expect(byId.get('entry-edit')?.released.reset).toBe(true);
    expect(byId.get('entry-gone')?.deletedAt).toBeNull();

    // The phone deletes one entry; its next sync brings the laptop's edit and nothing it already has.
    const p2 = await sync(phone, { progress: p1.progress, journal: [entry('entry-gone', 300, { deletedAt: 300 })], cursor: p1.cursor });
    expect(p2.journal.map((e) => e.id).sort()).toEqual(['entry-edit', 'entry-gone']);
    expect(p2.journal.find((e) => e.id === 'entry-gone')).toMatchObject({ deletedAt: 300, note: '' });

    // The laptop learns of the deletion only.
    const l2 = await sync(laptop, { progress: l1.progress, journal: [], cursor: l1.cursor });
    expect(l2.journal.map((e) => [e.id, e.deletedAt])).toEqual([['entry-gone', 300]]);
    expect(l2.cursor).toBe(p2.cursor);

    // An older edit sent after the cursor moved past it still gets the stored version back.
    const l3 = await sync(laptop, { progress: l2.progress, journal: [entry('entry-gone', 250, { note: 'revived?' })], cursor: l2.cursor });
    expect(l3.journal).toEqual([expect.objectContaining({ id: 'entry-gone', deletedAt: 300, updatedAt: 300 })]);
  });

  it('refuses a malformed request and another origin', async () => {
    const [phone] = await twoDevices('malformed');
    const post = (body: string): Promise<Response> => api(server, '/api/sync', { method: 'POST', cookie: phone, body });
    expect(await (await post(JSON.stringify({ progress: EMPTY_PROGRESS, journal: [{ id: 'x' }], cursor: 0 }))).json()).toEqual({ error: 'invalid-body' });
    expect((await post(JSON.stringify({ progress: EMPTY_PROGRESS, journal: [], cursor: -1 }))).status).toBe(400);
    expect((await post('{')).status).toBe(400);
    const crossSite = await fetch(`${server.origin}/api/sync`, { method: 'POST', headers: { cookie: phone, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
    expect(crossSite.status).toBe(403);
  });

  it('never writes a journal note to the log when a query fails', async () => {
    const [phone] = await twoDevices('broken-db');
    // Break the insert only (the reads before it still work), so the failing query carries the note as a parameter;
    // the database error's detail ("Failing row contains …") would carry it too.
    await server.database.db.execute(sql`alter table journal_entries add constraint broken_for_test check (length(note) < 0) not valid`);
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      const res = await api(server, '/api/sync', {
        method: 'POST',
        cookie: phone,
        body: JSON.stringify({ progress: EMPTY_PROGRESS, journal: [entry('entry-secret', 1, { note: 'bí mật riêng' })], cursor: 0 }),
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'internal' });
    } finally {
      spy.mockRestore();
      await server.database.db.execute(sql`alter table journal_entries drop constraint broken_for_test`);
    }
    const text = logged.join('\n');
    expect(text).toContain('query failed');
    expect(text).not.toContain('bí mật');
  });
});

describe('DELETE /api/me/data', () => {
  it('removes progress and the whole journal, keeps the account signed in, and a new sync starts empty', async () => {
    const [phone, laptop] = await twoDevices('delete-all');
    const other = (await twoDevices('bystander'))[0];
    await sync(other, { progress: progressOf({ merit: 3 }), journal: [entry('entry-other', 1)], cursor: 0 });
    await sync(phone, { progress: progressOf({ merit: 99 }), journal: [entry('entry-a001', 1), entry('entry-a002', 2)], cursor: 0 });

    const res = await api(server, '/api/me/data', { method: 'DELETE', cookie: laptop });
    expect(res.status).toBe(204);
    expect((await api(server, '/api/me', { cookie: phone })).status).toBe(200);

    const after = await sync(phone, { progress: EMPTY_PROGRESS, journal: [], cursor: 0 });
    expect(after).toEqual({ progress: EMPTY_PROGRESS, journal: [], cursor: 0 });
    // Someone else's data is untouched.
    const theirs = await sync(other, { progress: EMPTY_PROGRESS, journal: [], cursor: 0 });
    expect(theirs.progress.merit).toBe(3);
    expect(theirs.journal.map((e) => e.id)).toEqual(['entry-other']);
  });
});
