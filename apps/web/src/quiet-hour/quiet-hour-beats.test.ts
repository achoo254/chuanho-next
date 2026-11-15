import { QUIET_HOUR_BATCH_MAX, QUIET_HOUR_PERSON_CAP, type QuietHourBeatsInput, type QuietHourStatus, quietHourWindow } from '@chuanho/contract';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '../account/account-api';
import { FLUSH_EVERY_MS, createBeatBatcher } from './quiet-hour-beats';

const DAY = '2027-01-15';
const { start, end } = quietHourWindow(DAY);
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
type Reply = ApiResult<QuietHourStatus>;
const okStatus = (total: number): Reply => ({ ok: true, value: { day: DAY, open: true, startsAt: start, endsAt: end, total, milestones: [], serverNow: start } });

function setup(options: { now?: number; signedIn?: boolean; replies?: Reply[] } = {}) {
  let now = options.now ?? start + 60_000;
  let timers: { at: number; run: () => void }[] = [];
  const replies = [...(options.replies ?? [])];
  const sent: QuietHourBeatsInput[] = [];
  const onStatus = vi.fn();
  const batcher = createBeatBatcher({
    send: async (input) => {
      sent.push(input);
      return replies.shift() ?? okStatus(input.count);
    },
    serverNow: () => now,
    isSignedIn: () => options.signedIn ?? true,
    later: (run, ms) => {
      const timer = { at: now + ms, run };
      timers.push(timer);
      return () => {
        timers = timers.filter((t) => t !== timer);
      };
    },
    onStatus,
  });
  const advance = async (ms: number): Promise<void> => {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const timer of due) timer.run();
    await settle();
  };
  const strike = (times: number): void => {
    for (let i = 0; i < times; i += 1) batcher.add();
  };
  return { batcher, sent, onStatus, advance, strike, setNow: (at: number) => void (now = at) };
}

describe('quiet hour stroke batcher', () => {
  it('sends strokes together every few seconds, not one by one', async () => {
    const t = setup();
    t.strike(7);
    expect(t.sent).toEqual([]);
    await t.advance(FLUSH_EVERY_MS);
    expect(t.sent).toEqual([{ day: DAY, count: 7 }]);
    expect(t.onStatus).toHaveBeenCalledOnce();
  });

  it('splits a long burst into batches of at most the contract maximum', async () => {
    const t = setup();
    t.strike(QUIET_HOUR_BATCH_MAX + 5);
    await t.batcher.flush();
    expect(t.sent.map((input) => input.count)).toEqual([QUIET_HOUR_BATCH_MAX, 5]);
  });

  it('never sends for a guest or outside the half hour', async () => {
    const guest = setup({ signedIn: false });
    guest.strike(3);
    await guest.batcher.flush();
    expect(guest.sent).toEqual([]);
    const early = setup({ now: start - 60_000 });
    early.strike(3);
    await early.batcher.flush();
    expect(early.sent).toEqual([]);
  });

  it('stops counting at the personal cap', async () => {
    const t = setup();
    t.strike(QUIET_HOUR_PERSON_CAP + 50);
    await t.batcher.flush();
    expect(t.sent.reduce((sum, input) => sum + input.count, 0)).toBe(QUIET_HOUR_PERSON_CAP);
    t.strike(10);
    expect(t.batcher.pending()).toBe(0);
  });

  it('drops a batch quietly when the server says the half hour closed', async () => {
    const t = setup({ replies: [{ ok: false, error: { kind: 'conflict', code: 'quiet-hour-closed' } }] });
    t.strike(4);
    await t.batcher.flush();
    expect(t.batcher.pending()).toBe(0);
    expect(t.onStatus).not.toHaveBeenCalled();
  });

  it('keeps strokes through a network failure, and drops them once the window is over', async () => {
    const t = setup({ replies: [{ ok: false, error: { kind: 'offline' } }] });
    t.strike(4);
    await t.batcher.flush();
    expect(t.batcher.pending()).toBe(4);
    await t.advance(FLUSH_EVERY_MS);
    expect(t.sent.at(-1)).toEqual({ day: DAY, count: 4 });
    expect(t.batcher.pending()).toBe(0);

    const late = setup({ replies: [{ ok: false, error: { kind: 'server', status: 500 } }] });
    late.strike(2);
    await late.batcher.flush();
    late.setNow(end + 1);
    await late.batcher.flush();
    expect(late.batcher.pending()).toBe(0);
    expect(late.sent).toHaveLength(1);
  });
});
