import { describe, expect, it } from 'vitest';
import { type IdleNudgeOptions, type NudgeTimers, createIdleNudgeController } from './idle-nudge-controller';

/** A hand-driven clock: `advance(ms)` fires every timer that falls due, in order. */
function fakeTimers(): NudgeTimers & { advance(ms: number): void; pending(): number } {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].callback();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

const OPTIONS: IdleNudgeOptions = { firstDelayMs: 25_000, gapMs: [90_000, 150_000], showMs: 6_000, random: () => 0 };

function setup(options: Partial<IdleNudgeOptions> = {}) {
  const clock = fakeTimers();
  const log: string[] = [];
  const controller = createIdleNudgeController({ ...OPTIONS, ...options }, clock, (count) => log.push(`show ${count}`), () => log.push('hide'));
  return { clock, log, controller };
}

describe('createIdleNudgeController', () => {
  it('waits for idleness, shows the first nudge after the first delay and hides it after a while', () => {
    const { clock, log, controller } = setup();
    clock.advance(60_000);
    expect(log).toEqual([]);
    controller.setIdle(true);
    clock.advance(24_999);
    expect(log).toEqual([]);
    clock.advance(1);
    expect(log).toEqual(['show 1']);
    clock.advance(6_000);
    expect(log).toEqual(['show 1', 'hide']);
  });

  it('spaces the next nudges by a gap within the range', () => {
    const { clock, log, controller } = setup({ random: () => 0.5 });
    controller.setIdle(true);
    clock.advance(25_000 + 6_000);
    clock.advance(119_999);
    expect(log).toEqual(['show 1', 'hide']);
    clock.advance(1);
    expect(log).toEqual(['show 1', 'hide', 'show 2']);
  });

  it('hides on a tap and on leaving the idle place, and starts over when idle again', () => {
    const { clock, log, controller } = setup();
    controller.setIdle(true);
    clock.advance(25_000);
    controller.dismiss();
    expect(log).toEqual(['show 1', 'hide']);
    clock.advance(90_000);
    expect(log.at(-1)).toBe('show 2');
    controller.setIdle(false);
    expect(log.at(-1)).toBe('hide');
    expect(clock.pending()).toBe(0);
    controller.setIdle(true);
    clock.advance(25_000);
    expect(log.at(-1)).toBe('show 3');
  });

  it('skips a nudge that is not allowed and asks again after a gap', () => {
    let allowed = false;
    const { clock, log, controller } = setup({ allowed: () => allowed });
    controller.setIdle(true);
    clock.advance(25_000);
    expect(log).toEqual([]);
    allowed = true;
    clock.advance(90_000);
    expect(log).toEqual(['show 1']);
  });

  it('stops for good when disposed', () => {
    const { clock, log, controller } = setup();
    controller.setIdle(true);
    controller.dispose();
    clock.advance(1_000_000);
    expect(log).toEqual([]);
    expect(clock.pending()).toBe(0);
  });
});
