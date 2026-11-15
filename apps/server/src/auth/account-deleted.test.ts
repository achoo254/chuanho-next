/**
 * An account deleted at the IdP (auth-next ADR 0018, POST /api/idp/account-deleted): which notices are taken, that
 * everything of the account goes and nothing of another account does, that it is signed out everywhere, and that a
 * repeated notice changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMPTY_PROGRESS } from '@chuanho/contract';
import { eq } from 'drizzle-orm';
import { type FakeIdp, startFakeIdp } from '../../test/fake-idp';
import { api, signIn } from '../../test/sign-in';
import { type TestServer, startTestServer } from '../../test/test-server';
import { journalEntries, progress, quietHourDays, quietHourPeople, sessions, users } from '../db/schema';
import { ACCOUNT_DELETED_PATH } from './account-deleted';

const SECRET = 'test-secret-'.padEnd(40, 'x');

let idp: FakeIdp;
let server: TestServer;

const receiver = (target: TestServer = server): string => `${target.origin}${ACCOUNT_DELETED_PATH}`;
/** The IdP's POST: server to server, no Origin, no cookie. */
const notify = (body: string, type = 'application/secevent+jwt', target: TestServer = server): Promise<Response> =>
  fetch(receiver(target), { method: 'POST', headers: { 'content-type': type }, body });
const noticeFor = (sub: string, options?: Parameters<FakeIdp['accountDeletedToken']>[2]): string => idp.accountDeletedToken(sub, receiver(), options);
const b64url = (value: string): string => Buffer.from(value).toString('base64url');

beforeAll(async () => {
  idp = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'leaver', profile: { name: 'Người Rời', email: 'leaver@example.com' } });
  server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
});

afterAll(async () => {
  await server.close();
  await idp.close();
});

async function signedIn(session: string): Promise<boolean> {
  const res = await api(server, '/api/me', { cookie: session });
  return res.status === 200;
}

async function userOf(sub: string): Promise<string> {
  const [row] = await server.database.db.select({ id: users.id }).from(users).where(eq(users.sub, sub));
  if (!row) throw new Error(`no user ${sub}`);
  return row.id;
}

/** An account signed in on two browsers, with progress, a journal entry and quiet-hour strokes. */
async function accountWithData(sub: string): Promise<{ userId: string; sessions: string[] }> {
  idp.setSub(sub);
  const first = await signIn(server);
  const second = await signIn(server);
  const db = server.database.db;
  const userId = await userOf(sub);
  await db.insert(progress).values({ userId, doc: { ...EMPTY_PROGRESS, merit: 7 }, updatedAt: new Date() });
  await db.insert(journalEntries).values({
    userId,
    id: `entry-${sub}`,
    day: '2026-11-15',
    kind: 'harsh',
    note: 'riêng tư',
    releasedReset: false,
    releasedApology: false,
    releasedDeed: false,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  });
  await db.insert(quietHourPeople).values({ day: '2026-11-15', userId, count: 10 });
  return { userId, sessions: [first, second] };
}

describe('POST /api/idp/account-deleted: which notices are taken', () => {
  const nowS = (): number => Math.floor(Date.now() / 1000);

  it.each([
    ['a key the IdP never published', () => noticeFor('careful', { how: 'stranger' })],
    ['another receiver', () => noticeFor('careful', { claims: { aud: 'https://chat.hoandat.com/api/idp/account-deleted' } })],
    ['an audience list', () => noticeFor('careful', { claims: { aud: [receiver()] } })],
    ['another issuer', () => noticeFor('careful', { claims: { iss: 'https://evil.example' } })],
    ['an expired notice', () => noticeFor('careful', { claims: { iat: nowS() - 1200, exp: nowS() - 600 } })],
    ['no expiry', () => noticeFor('careful', { claims: { exp: undefined } })],
    ['another event', () => noticeFor('careful', { claims: { events: { 'urn:hoandat:auth:event:account.created': {} } } })],
    ['no sub', () => noticeFor('', {})],
  ])('refuses %s with 401 and deletes nothing', async (_label, makeToken) => {
    idp.setSub('careful');
    const session = await signIn(server);
    const res = await notify(makeToken());
    expect(res.status).toBe(401);
    expect(await signedIn(session)).toBe(true);
  });

  it('refuses a token signed with another algorithm than ES256', async () => {
    idp.setSub('careful');
    const session = await signIn(server);
    const [, payload = '', signature = ''] = noticeFor('careful').split('.');
    const forged = `${b64url(JSON.stringify({ alg: 'RS256', kid: 'fake-key-1', typ: 'secevent+jwt' }))}.${payload}.${signature}`;
    expect((await notify(forged)).status).toBe(401);
    expect(await signedIn(session)).toBe(true);
  });

  it.each([
    ['an empty body', () => ''],
    ['not a JWS', () => 'hello'],
    ['another token type (a logout token)', () => noticeFor('careful', { typ: 'logout+jwt' })],
  ])('answers 400 to %s', async (_label, makeBody) => {
    expect((await notify(makeBody())).status).toBe(400);
  });

  it('answers 400 to a SET sent as another media type', async () => {
    expect((await notify(noticeFor('careful'), 'application/json')).status).toBe(400);
  });

  it('answers 202 to an account this app never saw', async () => {
    expect((await notify(noticeFor('never-signed-in'))).status).toBe(202);
  });

  it('answers 503 when the IdP keys cannot be read, so the IdP retries', async () => {
    const down = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'x' });
    const issuer = down.issuer;
    await down.close();
    const cut = await startTestServer({ AUTH_ISSUER: issuer, AUTH_CLIENT_SECRET: SECRET });
    try {
      const notice = idp.accountDeletedToken('x', receiver(cut));
      expect((await notify(notice, undefined, cut)).status).toBe(503);
    } finally {
      await cut.close();
    }
  });

  it('answers 503 while sign-in is off (no IdP to check against)', async () => {
    const off = await startTestServer();
    try {
      expect((await notify(idp.accountDeletedToken('x', receiver(off)), undefined, off)).status).toBe(503);
    } finally {
      await off.close();
    }
  });
});

describe('POST /api/idp/account-deleted: what goes', () => {
  it('deletes everything of the account, signs it out everywhere and leaves other accounts alone', async () => {
    const db = server.database.db;
    const other = await accountWithData('stays');
    const { userId, sessions: browsers } = await accountWithData('leaver');
    await db.insert(quietHourDays).values({ day: '2026-11-15', total: 20 });

    const res = await notify(noticeFor('leaver'));
    expect(res.status).toBe(202);

    expect(await db.select().from(users).where(eq(users.id, userId))).toEqual([]);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toEqual([]);
    expect(await db.select().from(progress).where(eq(progress.userId, userId))).toEqual([]);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, userId))).toEqual([]);
    expect(await db.select().from(quietHourPeople).where(eq(quietHourPeople.userId, userId))).toEqual([]);
    for (const browser of browsers) expect(await signedIn(browser)).toBe(false);

    // The shared total is an anonymous sum: it stays.
    expect(await db.select({ total: quietHourDays.total }).from(quietHourDays)).toEqual([{ total: 20 }]);
    expect(await db.select().from(progress).where(eq(progress.userId, other.userId))).toHaveLength(1);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.userId, other.userId))).toHaveLength(1);
    expect(await db.select().from(quietHourPeople).where(eq(quietHourPeople.userId, other.userId))).toHaveLength(1);
    for (const browser of other.sessions) expect(await signedIn(browser)).toBe(true);
  });

  it('takes the same notice again (the IdP retries) without changing anything', async () => {
    await accountWithData('twice');
    const notice = noticeFor('twice');
    expect((await notify(notice)).status).toBe(202);
    expect((await notify(notice)).status).toBe(202);
    expect(await server.database.db.select().from(users).where(eq(users.sub, 'twice'))).toEqual([]);
  });
});
