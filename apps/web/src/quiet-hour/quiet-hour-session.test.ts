import { type QuietHourStatus, quietHourWindow } from '@chuanho/contract';
import { describe, expect, it, vi } from 'vitest';
import { createQuietHourSession } from './quiet-hour-session';

const { start, end } = quietHourWindow('2027-01-15');
const status = (serverNow: number, total = 0): QuietHourStatus => ({ day: '2027-01-15', open: true, startsAt: start, endsAt: end, total, milestones: [], serverNow });

describe('quiet hour session', () => {
  it('learns the server clock from a status and tells its listeners', () => {
    // This device runs two minutes slow.
    let device = start - 120_000 + 30_000;
    const session = createQuietHourSession({ sendQuietHourBeats: vi.fn() }, () => () => undefined, () => device);
    const listener = vi.fn();
    session.subscribe(listener);
    session.take(status(start + 30_000), device);
    expect(session.getSnapshot().offset).toBe(120_000);
    expect(session.serverNow()).toBe(start + 30_000);
    expect(listener).toHaveBeenCalledOnce();
    device += 1_000;
    expect(session.serverNow()).toBe(start + 31_000);
  });

  it('counts strokes on server time and only once signed in', async () => {
    const send = vi.fn(async () => ({ ok: true as const, value: status(start + 60_000, 3) }));
    const device = start - 120_000 + 60_000;
    const session = createQuietHourSession({ sendQuietHourBeats: send }, () => () => undefined, () => device);
    // By the device clock the half hour has not started yet; by the server's it has.
    session.take(status(start + 60_000), device);
    session.batcher.add();
    expect(session.batcher.pending()).toBe(0);
    session.setSignedIn(true);
    session.batcher.add();
    session.batcher.add();
    await session.batcher.flush();
    expect(send).toHaveBeenCalledWith({ day: '2027-01-15', count: 2 });
    expect(session.getSnapshot().status?.total).toBe(3);
  });
});
