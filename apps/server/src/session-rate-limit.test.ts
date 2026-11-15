/** The signed-in limit through POST /api/sync: per account once signed in, per IP before, so forged cookies buy nothing. */
import { EMPTY_PROGRESS } from '@chuanho/contract';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type FakeIdp, startFakeIdp } from '../test/fake-idp';
import { signIn } from '../test/sign-in';
import { postSync } from '../test/sync-client';
import { type TestServer, startTestServer } from '../test/test-server';
import { IP_SHARE } from './session-rate-limit';

const SECRET = 'test-secret-'.padEnd(40, 'x');
const PER_ACCOUNT = 2;

let idp: FakeIdp;
let server: TestServer;

beforeAll(async () => {
  idp = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'limited-1' });
  server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET }, { overrides: { syncLimitPer15Min: PER_ACCOUNT } });
});
afterAll(async () => {
  await server.close();
  await idp.close();
});

const emptySync = (cookie: string): Promise<Response> => postSync(server, cookie, { progress: EMPTY_PROGRESS, journal: [], cursor: 0 });

describe('signed-in rate limit', () => {
  it('counts per account (all its browsers together), then per IP whatever cookie a request carries', async () => {
    const phone = await signIn(server);
    const laptop = await signIn(server);
    idp.setSub('limited-2');
    const other = await signIn(server);

    expect((await emptySync(phone)).status).toBe(200);
    expect((await emptySync(laptop)).status).toBe(200);
    const limited = await emptySync(phone);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate-limited' });
    // Another account behind the same address has its own allowance.
    expect((await emptySync(other)).status).toBe(200);

    // Forged cookies are never looked up past the address's share: each fresh value does not get a bucket of its own.
    const statuses: number[] = [];
    for (let i = 0; i < PER_ACCOUNT * IP_SHARE; i += 1) statuses.push((await emptySync(`chuanho_session=forged-${i}`)).status);
    const lookedUp = statuses.filter((status) => status === 401).length;
    expect(lookedUp).toBe(PER_ACCOUNT * IP_SHARE - 4);
    expect(statuses.slice(lookedUp)).toEqual(Array(4).fill(429));
  });
});
