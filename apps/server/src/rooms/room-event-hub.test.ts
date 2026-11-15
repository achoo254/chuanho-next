/** The event hub with fake sinks and fake timers: coalescing, one shared serialization, stream caps, slow clients. */
import type { RoomSnapshot } from '@chuanho/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSED_EVENT, type EventSink, RoomEventHub, viewerEvent } from './room-event-hub';
import { RoomError, type SharedRoomSnapshot, type ViewerFields } from './room-model';
import type { RoomStreamView } from './room-store';

const SHARED: SharedRoomSnapshot = {
  code: 'ROOM22',
  name: 'Phòng',
  theme: 'deadline',
  burnMinutes: 30,
  hostId: 'm-1',
  locked: false,
  status: 'open',
  members: [],
  wishes: [],
  litTotal: 0,
  serverNow: 1,
};
const FIRST: RoomSnapshot = { ...SHARED, meId: 'm-1', myReportedWishId: null };

class FakeSink implements EventSink {
  readonly chunks: string[] = [];
  ended = false;
  destroyed = false;
  accept = true;
  writableLength = 0;
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return this.accept;
  }
  end(): void {
    this.ended = true;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

let litTotal: number;
let members: Map<string, ViewerFields>;
let views: number;
let hub: RoomEventHub;

beforeEach(() => {
  vi.useFakeTimers();
  litTotal = 0;
  views = 0;
  members = new Map([
    ['u-1', { meId: 'm-1', myReportedWishId: null }],
    ['u-2', { meId: 'm-2', myReportedWishId: 'w-9' }],
  ]);
  const viewOf = (): RoomStreamView => {
    views += 1;
    return { shared: { ...SHARED, litTotal }, viewer: (userId) => members.get(userId) ?? null };
  };
  hub = new RoomEventHub(viewOf, { coalesceMs: 250, streamsPerUser: 2, streamsTotal: 3 });
});
afterEach(() => {
  vi.useRealTimers();
});

const parse = (chunk: string | undefined): unknown => JSON.parse((chunk ?? '').replace(/^data: /, ''));

describe('RoomEventHub', () => {
  it('coalesces changes into one push and varies only the viewer fields per stream', () => {
    const one = new FakeSink();
    const two = new FakeSink();
    hub.open('ROOM22', 'u-1', one, FIRST);
    hub.open('ROOM22', 'u-2', two, FIRST);
    litTotal = 1;
    hub.broadcast('ROOM22');
    litTotal = 2;
    hub.broadcast('ROOM22');
    expect(one.chunks).toHaveLength(1);
    vi.advanceTimersByTime(250);
    expect(views).toBe(1);
    expect(parse(one.chunks[1])).toEqual({ ...SHARED, litTotal: 2, meId: 'm-1', myReportedWishId: null });
    expect(parse(two.chunks[1])).toEqual({ ...SHARED, litTotal: 2, meId: 'm-2', myReportedWishId: 'w-9' });
    expect(viewerEvent('{"a":1', { meId: 'x', myReportedWishId: null })).toBe('data: {"a":1,"meId":"x","myReportedWishId":null}\n\n');
  });

  it('closes the stream of a viewer who left and every stream of a room that is gone', () => {
    const one = new FakeSink();
    const two = new FakeSink();
    hub.open('ROOM22', 'u-1', one, FIRST);
    hub.open('ROOM22', 'u-2', two, FIRST);
    members.delete('u-2');
    hub.broadcast('ROOM22');
    vi.advanceTimersByTime(250);
    expect(two.chunks.at(-1)).toBe(CLOSED_EVENT);
    expect(two.ended).toBe(true);
    hub.broadcast('ROOM22');
    hub.closeRoom('ROOM22');
    expect(one.chunks.at(-1)).toBe(CLOSED_EVENT);
    expect(hub.size).toBe(0);
    vi.advanceTimersByTime(250);
    expect(one.chunks.filter((chunk) => chunk === CLOSED_EVENT)).toHaveLength(1);
  });

  it('caps streams per account and for the server, and frees a slot when a stream goes', () => {
    const forget = hub.open('ROOM22', 'u-1', new FakeSink(), FIRST);
    hub.open('OTHER2', 'u-1', new FakeSink(), FIRST);
    expect(() => hub.assertCapacity('u-1')).toThrow(RoomError);
    expect(() => hub.open('ROOM22', 'u-1', new FakeSink(), FIRST)).toThrow('too-many-streams');
    hub.open('ROOM22', 'u-2', new FakeSink(), FIRST);
    expect(() => hub.assertCapacity('u-3')).toThrow('too-many-streams');
    forget();
    forget();
    expect(hub.size).toBe(2);
    expect(() => hub.assertCapacity('u-1')).not.toThrow();
  });

  it('drops a client that stopped reading instead of buffering for it', () => {
    const slow = new FakeSink();
    const full = new FakeSink();
    hub.open('ROOM22', 'u-1', slow, FIRST);
    hub.open('ROOM22', 'u-2', full, FIRST);
    slow.accept = false;
    full.writableLength = 10 * 1024 * 1024;
    hub.broadcast('ROOM22');
    vi.advanceTimersByTime(250);
    expect(full.destroyed).toBe(true);
    for (let i = 0; i < 8; i += 1) {
      hub.broadcast('ROOM22');
      vi.advanceTimersByTime(250);
    }
    expect(slow.destroyed).toBe(true);
    expect(hub.size).toBe(0);
  });
});
