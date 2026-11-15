/** "Giờ Tĩnh" through the HTTP API, on a clock the test moves (sign-in itself runs on real time). */
import { QUIET_HOUR_PERSON_CAP, type QuietHourStatus, quietHourWindow, vietnamDay } from '@chuanho/contract';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { quietHourPeople, users } from '../db/schema';
import { type FakeIdp, startFakeIdp } from '../../test/fake-idp';
import { api, signIn } from '../../test/sign-in';
import { type TestServer, startTestServer } from '../../test/test-server';

const SECRET = 'test-secret-'.padEnd(40, 'x');
const MINUTE = 60_000;

let idp: FakeIdp;
let server: TestServer;
/** Fixed time the app sees, or null for real time. */
let clock: number | null = null;

// Tonight's half hour of the real day: close enough to real time that sessions opened just before stay valid.
const TODAY = vietnamDay(Date.now());
const WINDOW = quietHourWindow(TODAY);

beforeAll(async () => {
  idp = await startFakeIdp({ clientId: 'chuanho-web', clientSecret: SECRET, sub: 'striker-1' });
  server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET }, { now: () => new Date(clock ?? Date.now()) });
});
afterAll(async () => {
  await server.close();
  await idp.close();
});

async function signedInAs(sub: string): Promise<string> {
  clock = null;
  idp.setSub(sub);
  return signIn(server);
}

const beats = (session: string, day: string, count: number): Promise<Response> =>
  api(server, '/api/quiet-hour/beats', { method: 'POST', cookie: session, body: JSON.stringify({ day, count }) });

async function statusOf(res: Response): Promise<QuietHourStatus> {
  expect(res.status).toBe(200);
  return (await res.json()) as QuietHourStatus;
}

describe('quiet hour', () => {
  it('shows a public status, closed outside the half hour', async () => {
    clock = WINDOW.start - MINUTE;
    const status = await statusOf(await fetch(`${server.origin}/api/quiet-hour`));
    expect(status).toEqual({ day: TODAY, open: false, startsAt: WINDOW.start, endsAt: WINDOW.end, total: 0, milestones: [], serverNow: clock });
  });

  it('answers 401 to strokes from a signed-out player', async () => {
    clock = WINDOW.start + MINUTE;
    const res = await api(server, '/api/quiet-hour/beats', { method: 'POST', body: JSON.stringify({ day: TODAY, count: 5 }) });
    expect(res.status).toBe(401);
  });

  it('counts strokes only inside the window and for tonight', async () => {
    const session = await signedInAs('striker-window');
    clock = WINDOW.start - MINUTE;
    expect(await (await beats(session, TODAY, 10)).json()).toEqual({ error: 'quiet-hour-closed' });
    clock = WINDOW.end;
    expect((await beats(session, TODAY, 10)).status).toBe(409);
    clock = WINDOW.start + MINUTE;
    expect((await beats(session, vietnamDay(WINDOW.start - 86_400_000), 10)).status).toBe(409);
    expect((await beats(session, TODAY, 0)).status).toBe(400);
    expect((await beats(session, TODAY, 81)).status).toBe(400);
    const status = await statusOf(await beats(session, TODAY, 10));
    expect(status).toMatchObject({ day: TODAY, open: true, total: 10 });
  });

  it('caps each person per night and adds everyone up', async () => {
    const first = await signedInAs('striker-cap');
    clock = WINDOW.start + 2 * MINUTE;
    let total = (await statusOf(await fetch(`${server.origin}/api/quiet-hour`))).total;
    for (let sent = 0; sent < QUIET_HOUR_PERSON_CAP; sent += 80) {
      total = (await statusOf(await beats(first, TODAY, 80))).total;
    }
    // Over the cap: accepted, nothing added.
    expect((await statusOf(await beats(first, TODAY, 80))).total).toBe(total);

    const second = await signedInAs('striker-other');
    clock = WINDOW.start + 3 * MINUTE;
    const after = await statusOf(await beats(second, TODAY, 25));
    expect(after.total).toBe(total + 25);
    expect(after.milestones).toEqual(after.total >= 1000 ? [1000] : []);
    expect((await statusOf(await fetch(`${server.origin}/api/quiet-hour`))).total).toBe(total + 25);
  });

  it("keeps tonight's per-person cap and the shared total through a data delete, and drops past nights", async () => {
    const session = await signedInAs('striker-leaves');
    const [me] = await server.database.db.select({ id: users.id }).from(users).where(eq(users.sub, 'striker-leaves'));
    if (!me) throw new Error('no user row');
    const yesterday = vietnamDay(WINDOW.start - 86_400_000);
    await server.database.db.insert(quietHourPeople).values({ day: yesterday, userId: me.id, count: 12 });
    clock = WINDOW.start + 4 * MINUTE;
    let total = 0;
    for (let sent = 0; sent < QUIET_HOUR_PERSON_CAP; sent += 80) total = (await statusOf(await beats(session, TODAY, 80))).total;
    clock = null;
    expect((await api(server, '/api/me/data', { method: 'DELETE', cookie: session })).status).toBe(204);
    clock = WINDOW.start + 5 * MINUTE;
    // Still at the cap for tonight: accepted, nothing added.
    expect((await statusOf(await beats(session, TODAY, 5))).total).toBe(total);
    const rows = await server.database.db.select({ day: quietHourPeople.day }).from(quietHourPeople).where(eq(quietHourPeople.userId, me.id));
    expect(rows.map((row) => row.day)).toEqual([TODAY]);
  });
});
