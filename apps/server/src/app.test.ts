import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { type FakeIdp, startFakeIdp } from '../test/fake-idp';
import { RETURN_TO, api, cookieFrom, location, signIn } from '../test/sign-in';
import { type TestServer, startTestServer } from '../test/test-server';
import { users } from './db/schema';

const CLIENT_ID = 'chuanho-web';
const SECRET = 'test-secret-'.padEnd(40, 'x');
const PROFILE_A = { name: 'Nguyễn Văn An', preferred_username: 'van-an', email: 'an@example.com', picture: 'https://lh3.googleusercontent.com/a/photo' };

describe('without sign-in configured', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('answers the health check', async () => {
    const res = await fetch(`${server.origin}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('answers 401 for /api/me and sends /auth/login back with a notice', async () => {
    const me = await fetch(`${server.origin}/api/me`);
    expect(me.status).toBe(401);
    expect(await me.json()).toEqual({ error: 'sign-in-required' });
    const res = await fetch(`${server.origin}/auth/login?return=/`, { redirect: 'manual' });
    expect(location(res)).toBe('/?login=unavailable');
  });

  it('keeps sync and data deletion behind sign-in', async () => {
    expect((await api(server, '/api/sync', { method: 'POST', body: '{}' })).status).toBe(401);
    expect((await api(server, '/api/me/data', { method: 'DELETE' })).status).toBe(401);
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const res = await fetch(`${server.origin}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
  });
});

describe('signed in through the hoandat.com account', () => {
  let idp: FakeIdp;
  let server: TestServer;

  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, clientSecret: SECRET, sub: 'account-a', profile: PROFILE_A });
    server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
  });
  afterAll(async () => {
    await server.close();
    await idp.close();
  });

  it('opens a session from Code + PKCE, answers /api/me with the given name only, and ends it on logout', async () => {
    const session = await signIn(server);
    expect(session).toMatch(/^chuanho_session=[A-Za-z0-9_-]{43}$/);
    const me = await api(server, '/api/me', { cookie: session });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { id: string; name: string };
    expect(body).toEqual({ id: expect.any(String), name: 'An' });
    // Nothing of the email reaches the database.
    const [row] = await server.database.db.select().from(users).where(eq(users.sub, 'account-a'));
    expect(JSON.stringify(row)).not.toContain('example.com');

    const logout = await api(server, '/auth/logout', { method: 'POST', cookie: session });
    expect(logout.status).toBe(204);
    expect((await api(server, '/api/me', { cookie: session })).status).toBe(401);
  });

  it('keeps the stored name when userinfo fails, and answers an empty name when the IdP has none', async () => {
    idp.setSub('account-b');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      idp.setProfile({});
      expect(await (await api(server, '/api/me', { cookie: await signIn(server) })).json()).toMatchObject({ name: '' });
      idp.setProfile({ name: 'Lê Thị Mai' });
      expect(await (await api(server, '/api/me', { cookie: await signIn(server) })).json()).toMatchObject({ name: 'Mai' });
      idp.failUserinfo(true);
      expect(await (await api(server, '/api/me', { cookie: await signIn(server) })).json()).toMatchObject({ name: 'Mai' });
      expect(warn).toHaveBeenCalledWith('userinfo not used', 500);
    } finally {
      warn.mockRestore();
      idp.failUserinfo(false);
      idp.setProfile(PROFILE_A);
      idp.setSub('account-a');
    }
  });

  it('opens the IdP on making an account when a sign-up button sent the person', async () => {
    const start = await fetch(`${server.origin}/auth/login?return=${encodeURIComponent(RETURN_TO)}&lang=en&signup=1`, { redirect: 'manual' });
    const authorize = new URL(location(start));
    expect(authorize.searchParams.get('prompt')).toBe('create');
    expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(authorize.searchParams.get('ui_locales')).toBe('en');
    const consent = await fetch(authorize, { redirect: 'manual' });
    const callback = await fetch(location(consent), { redirect: 'manual', headers: { cookie: cookieFrom(start, 'chuanho_login') } });
    expect(location(callback)).toBe(RETURN_TO);
  });

  it('rejects a callback without the login cookie or with another state', async () => {
    const start = await fetch(`${server.origin}/auth/login`, { redirect: 'manual' });
    const consent = await fetch(location(start), { redirect: 'manual' });
    const noCookie = await fetch(location(consent), { redirect: 'manual' });
    expect(location(noCookie)).toBe('/?login=fail');
    expect(noCookie.headers.getSetCookie().some((c) => c.startsWith('chuanho_session='))).toBe(false);

    const again = await fetch(`${server.origin}/auth/login`, { redirect: 'manual' });
    const wrongState = new URL(location(await fetch(location(again), { redirect: 'manual' })));
    wrongState.searchParams.set('state', 'forged');
    const forged = await fetch(wrongState, { redirect: 'manual', headers: { cookie: cookieFrom(again, 'chuanho_login') } });
    expect(location(forged)).toBe('/?login=fail');
  });

  it('refuses state changes from another origin (CSRF)', async () => {
    const session = await signIn(server);
    const crossSite = await fetch(`${server.origin}/api/me/data`, { method: 'DELETE', headers: { cookie: session, origin: 'https://evil.example' } });
    expect(crossSite.status).toBe(403);
    const noOrigin = await fetch(`${server.origin}/auth/logout`, { method: 'POST', headers: { cookie: session } });
    expect(noOrigin.status).toBe(403);
  });
});

describe('sign-in limits and session hygiene', () => {
  let idp: FakeIdp;
  let server: TestServer;

  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, clientSecret: SECRET, sub: 'account-c' });
    server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET }, { overrides: { signInLimitPer15Min: 3 } });
  });
  afterAll(async () => {
    await server.close();
    await idp.close();
  });

  it('replaces the browser’s previous session when it signs in again', async () => {
    const first = await signIn(server);
    const start = await fetch(`${server.origin}/auth/login`, { redirect: 'manual' });
    const consent = await fetch(location(start), { redirect: 'manual' });
    const callback = await fetch(location(consent), { redirect: 'manual', headers: { cookie: `${cookieFrom(start, 'chuanho_login')}; ${first}` } });
    const second = cookieFrom(callback, 'chuanho_session');
    expect(second).not.toBe(first);
    expect((await api(server, '/api/me', { cookie: first })).status).toBe(401);
    expect((await api(server, '/api/me', { cookie: second })).status).toBe(200);
  });

  it('sends a start over the limit back to the page with a notice, not a bare 429', async () => {
    // Two starts were used above (limit 3 per window).
    expect((await fetch(`${server.origin}/auth/login?return=/`, { redirect: 'manual' })).status).toBe(302);
    const over = await fetch(`${server.origin}/auth/login?return=/credits`, { redirect: 'manual' });
    expect(over.status).toBe(302);
    expect(location(over)).toBe('/credits?login=busy');
  });
});
