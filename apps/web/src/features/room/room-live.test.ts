import type { RoomSnapshot } from '@chuanho/contract';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RoomApiResult } from './room-api';
import { type EventSourceLike, type LiveDeps, type LiveMode, POLL_MS, STREAM_RETRY_MS, connectRoomLive } from './room-live';

const snapshot = (litTotal: number): RoomSnapshot => ({
  code: 'ABC234',
  name: 'Phòng',
  theme: 'deadline',
  burnMinutes: 60,
  hostId: 'm1',
  locked: false,
  status: 'open',
  members: [],
  wishes: [],
  litTotal,
  meId: 'm1',
  myReportedWishId: null,
  serverNow: 1000,
});

class FakeSource implements EventSourceLike {
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closedListener: (() => void) | null = null;
  isClosed = false;
  addEventListener(_type: 'closed', listener: () => void): void {
    this.closedListener = listener;
  }
  close(): void {
    this.isClosed = true;
    this.readyState = 2;
  }
  message(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }
  fail(readyState: number): void {
    this.readyState = readyState;
    this.onerror?.(new Event('error'));
  }
}

/** Timers run by hand, in order of due time. */
let now: number;
let timers: Map<number, { at: number; run: () => void }>;
let sources: FakeSource[];
let pollAnswers: RoomApiResult<RoomSnapshot>[];
let polls: number;
let seen: number[];
let modes: LiveMode[];
let gone: unknown[];

beforeEach(() => {
  now = 0;
  timers = new Map();
  sources = [];
  pollAnswers = [];
  polls = 0;
  seen = [];
  modes = [];
  gone = [];
});

let nextTimer = 1;
function deps(streams = true): LiveDeps {
  return {
    openStream: () => {
      if (!streams) return null;
      const source = new FakeSource();
      sources.push(source);
      return source;
    },
    poll: () => {
      polls += 1;
      return Promise.resolve(pollAnswers.shift() ?? { ok: true, value: snapshot(polls) });
    },
    setTimer: (run, ms) => {
      const id = nextTimer++;
      timers.set(id, { at: now + ms, run });
      return id;
    },
    clearTimer: (id) => void timers.delete(id),
  };
}

/** Moves the clock, running due timers (and letting their polls settle). */
async function advance(ms: number): Promise<void> {
  const until = now + ms;
  for (;;) {
    const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]);
    now = due[1].at;
    due[1].run();
    await Promise.resolve();
    await Promise.resolve();
  }
  now = until;
}

const handlers = {
  onSnapshot: (s: RoomSnapshot) => seen.push(s.litTotal),
  onMode: (mode: LiveMode) => modes.push(mode),
  onGone: (error: unknown) => gone.push(error),
};

describe('connectRoomLive', () => {
  it('follows the event stream and ignores broken messages', () => {
    connectRoomLive(handlers, deps());
    const source = sources[0];
    if (!source) throw new Error('no stream');
    source.onopen?.(new Event('open'));
    source.message(JSON.stringify(snapshot(3)));
    source.message('not json');
    expect(seen).toEqual([3]);
    expect(modes).toEqual(['connecting', 'live']);
  });

  it('polls while the stream reconnects and stops once it is back', async () => {
    connectRoomLive(handlers, deps());
    const source = sources[0];
    if (!source) throw new Error('no stream');
    source.fail(0);
    await advance(POLL_MS * 2);
    expect(polls).toBe(3);
    source.onopen?.(new Event('open'));
    await advance(POLL_MS * 3);
    expect(polls).toBe(3);
    expect(modes.at(-1)).toBe('live');
  });

  it('falls back to polling when the stream is refused, and tries the stream again later', async () => {
    connectRoomLive(handlers, deps());
    sources[0]?.fail(2);
    expect(modes.at(-1)).toBe('polling');
    await advance(STREAM_RETRY_MS);
    expect(sources).toHaveLength(2);
    expect(polls).toBeGreaterThan(5);
  });

  it('polls when EventSource does not exist and stops when the room is gone', async () => {
    connectRoomLive(handlers, deps(false));
    pollAnswers = [{ ok: true, value: snapshot(1) }, { ok: false, error: { kind: 'offline' } }, { ok: false, error: { kind: 'room', code: 'room-not-found' } }];
    await advance(POLL_MS * 5);
    expect(modes).toEqual(['polling']);
    expect(seen).toEqual([1]);
    expect(gone).toEqual([{ kind: 'room', code: 'room-not-found' }]);
    expect(polls).toBe(3);
  });

  it('ends on the closed event and when stopped', async () => {
    const stop = connectRoomLive(handlers, deps());
    sources[0]?.closedListener?.();
    expect(gone).toEqual([null]);
    expect(sources[0]?.isClosed).toBe(true);
    connectRoomLive(handlers, deps());
    stop();
    const second = connectRoomLive(handlers, deps());
    second();
    expect(sources[2]?.isClosed).toBe(true);
    await advance(STREAM_RETRY_MS * 2);
    expect(polls).toBe(0);
  });
});
