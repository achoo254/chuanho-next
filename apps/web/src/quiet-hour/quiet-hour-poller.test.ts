import { describe, expect, it, vi } from 'vitest';
import { createQuietHourPoller } from './quiet-hour-poller';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  let visible = true;
  let timers: { run: () => void; ms: number }[] = [];
  let release: () => void = () => undefined;
  let held = false;
  const check = vi.fn(async (): Promise<void> => {
    if (held) await new Promise<void>((resolve) => (release = resolve));
  });
  const poller = createQuietHourPoller({
    check,
    isVisible: () => visible,
    nextDelay: () => 30_000,
    later(run, ms) {
      const timer = { run, ms };
      timers.push(timer);
      return () => {
        timers = timers.filter((t) => t !== timer);
      };
    },
  });
  return {
    poller,
    check,
    timers: () => timers,
    fire: async () => {
      const due = timers.splice(0);
      for (const timer of due) timer.run();
      await settle();
    },
    setVisible: (next: boolean) => void (visible = next),
    hold: () => void (held = true),
    release: async () => {
      held = false;
      release();
      await settle();
    },
  };
}

describe('quiet hour poller', () => {
  it('keeps one timer: polls, then schedules the next', async () => {
    const t = setup();
    t.poller.start();
    await settle();
    expect(t.check).toHaveBeenCalledOnce();
    expect(t.timers()).toHaveLength(1);
    await t.fire();
    expect(t.check).toHaveBeenCalledTimes(2);
    expect(t.timers()).toHaveLength(1);
  });

  it('does not start a second chain when the tab comes back while a request is out', async () => {
    const t = setup();
    t.hold();
    t.poller.start();
    t.poller.wake();
    t.poller.wake();
    expect(t.check).toHaveBeenCalledOnce();
    await t.release();
    expect(t.timers()).toHaveLength(1);
  });

  it('polls at once on wake, replacing the waiting timer', async () => {
    const t = setup();
    t.poller.start();
    await settle();
    t.poller.wake();
    await settle();
    expect(t.check).toHaveBeenCalledTimes(2);
    expect(t.timers()).toHaveLength(1);
  });

  it('skips the request while hidden but keeps the chain', async () => {
    const t = setup();
    t.setVisible(false);
    t.poller.start();
    await settle();
    t.poller.wake();
    expect(t.check).not.toHaveBeenCalled();
    expect(t.timers()).toHaveLength(1);
  });

  it('schedules nothing after stopping, even when a request was out', async () => {
    const t = setup();
    t.hold();
    t.poller.start();
    t.poller.stop();
    await t.release();
    t.poller.wake();
    expect(t.timers()).toHaveLength(0);
    expect(t.check).toHaveBeenCalledOnce();
  });
});
