/** What the server keeps of a journal through the HTTP API: clamped future clocks, purged old deletions, the row cap. */
import { EMPTY_PROGRESS, type JournalEntry } from '@chuanho/contract';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { journalEntries, users } from '../db/schema';
import { type FakeIdp, startFakeIdp } from '../../test/fake-idp';
import { signIn } from '../../test/sign-in';
import { journalEntry as entry, postSync, progressOf, syncOk } from '../../test/sync-client';
import { type TestServer, startTestServer } from '../../test/test-server';
import { FUTURE_SKEW_MS, TOMBSTONE_KEEP_MS } from './journal-retention';
import { JOURNAL_ROW_CAP } from './sync-store';

const SECRET = 'test-secret-'.padEnd(40, 'x');

let idp: FakeIdp;
let server: TestServer;

beforeAll(async () => {
  idp = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'keeper-1' });
  server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
});
afterAll(async () => {
  await server.close();
  await idp.close();
});

async function twoDevices(sub: string): Promise<[string, string]> {
  idp.setSub(sub);
  return [await signIn(server), await signIn(server)];
}

async function rowsOf(sub: string): Promise<number> {
  const [row] = await server.database.db.select({ rows: count() }).from(journalEntries).innerJoin(users, eq(users.id, journalEntries.userId)).where(eq(users.sub, sub));
  return row?.rows ?? 0;
}

const many = (prefix: string, from: number, size: number, change: Partial<JournalEntry> = {}): JournalEntry[] =>
  Array.from({ length: size }, (_, i) => entry(`${prefix}-${String(from + i).padStart(5, '0')}`, 1_700_000_000_000 + from + i, { note: '', ...change }));

describe('sync retention', () => {
  it('pulls times from a clock far in the future back to a day ahead of the server', async () => {
    const [phone, laptop] = await twoDevices('future-clock');
    const future = Date.now() + 10 * 365 * 86_400_000;
    const before = Date.now();
    const res = await syncOk(server, phone, {
      progress: progressOf({ moSkin: 'fish', updatedAt: future }),
      journal: [entry('entry-futr', future, { createdAt: future, deletedAt: null })],
      cursor: 0,
    });
    const after = Date.now();
    for (const time of [res.progress.updatedAt, res.journal[0]?.updatedAt ?? 0, res.journal[0]?.createdAt ?? 0]) {
      expect(time).toBeGreaterThanOrEqual(before + FUTURE_SKEW_MS);
      expect(time).toBeLessThanOrEqual(after + FUTURE_SKEW_MS);
    }
    // A later real edit still wins over the clamped one.
    const edit = await syncOk(server, laptop, { progress: progressOf({ moSkin: 'red', updatedAt: after + 2 * FUTURE_SKEW_MS }), journal: [], cursor: 0 });
    expect(edit.progress.moSkin).toBe('red');
  });

  it('purges deletion marks older than the keep time and keeps recent ones', async () => {
    const [phone, laptop] = await twoDevices('old-tombstones');
    const old = Date.now() - TOMBSTONE_KEEP_MS - 86_400_000;
    const recent = Date.now() - 86_400_000;
    await syncOk(server, phone, { progress: EMPTY_PROGRESS, journal: [entry('entry-old0', old, { deletedAt: old }), entry('entry-rec0', recent, { deletedAt: recent })], cursor: 0 });
    const seen = await syncOk(server, laptop, { progress: EMPTY_PROGRESS, journal: [], cursor: 0 });
    expect(seen.journal.map((e) => e.id)).toEqual(['entry-rec0']);
    expect(await rowsOf('old-tombstones')).toBe(1);
  });

  it('refuses only live entries beyond the cap; deletion marks give way, oldest first', async () => {
    const [phone] = await twoDevices('full-journal');
    const half = JOURNAL_ROW_CAP / 2;
    await syncOk(server, phone, { progress: EMPTY_PROGRESS, journal: many('live', 0, half), cursor: 0 });
    await syncOk(server, phone, { progress: EMPTY_PROGRESS, journal: many('live', half, half), cursor: 0 });
    const over = await postSync(server, phone, { progress: EMPTY_PROGRESS, journal: many('more', 0, 1), cursor: 0 });
    expect(over.status).toBe(409);
    expect(await over.json()).toEqual({ error: 'journal-full' });

    // Deleting ten makes room for ten new ones; the rows stay at the cap by dropping the oldest marks.
    const now = Date.now();
    const deletions = many('live', 0, 10).map((e, i) => ({ ...e, updatedAt: now + i, deletedAt: now + i }));
    await syncOk(server, phone, { progress: EMPTY_PROGRESS, journal: deletions, cursor: 0 });
    await syncOk(server, phone, { progress: EMPTY_PROGRESS, journal: many('more', 0, 10), cursor: 0 });
    expect(await rowsOf('full-journal')).toBe(JOURNAL_ROW_CAP);
    expect((await postSync(server, phone, { progress: EMPTY_PROGRESS, journal: many('more', 10, 1), cursor: 0 })).status).toBe(409);
  }, 60_000);
});
