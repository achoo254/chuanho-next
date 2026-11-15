import type { RoomSnapshot } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { INITIAL_ROOM_SESSION, roomSessionReducer } from './room-session-state';
import { clockOffset, errorKey, roomView, wishFeedback } from './room-view-model';

const MINUTE = 60_000;

const room = (over: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  code: 'ABC234',
  name: 'Giải nghiệp phòng PTPM',
  theme: 'deadline',
  burnMinutes: 60,
  hostId: 'm-host',
  locked: false,
  status: 'open',
  members: [
    { id: 'm-host', name: 'An', stick: { litAt: 0, burnsOutAt: 60 * MINUTE } },
    { id: 'm-me', name: '', stick: null },
    { id: 'm-3', name: 'Chi', stick: { litAt: 10 * MINUTE, burnsOutAt: 70 * MINUTE } },
  ],
  wishes: [
    { id: 'w1', memberId: 'm-host', text: 'Cho sprint êm', at: 1, reports: 0 },
    { id: 'w2', memberId: 'm-me', text: 'Ngủ đủ giấc', at: 2, reports: 1 },
  ],
  litTotal: 2,
  meId: 'm-me',
  myReportedWishId: null,
  serverNow: 30 * MINUTE,
  ...over,
});

describe('roomView', () => {
  it('burns each stick on the server clock and counts down to the last one', () => {
    const view = roomView(room(), 30 * MINUTE);
    expect(view.members[0]?.stick).toEqual({ progress: 0.5, minutesLeft: 30, burntOut: false });
    expect(view.burning).toBe(2);
    expect(view.minutesLeft).toBe(40);
    expect(view.smoke).toBeCloseTo(2 / 12);
    expect(view.canLight).toBe(true);
    expect(view.me?.isMe).toBe(true);
    expect(view.isHost).toBe(false);
  });

  it('lists wishes newest first with who may delete and report', () => {
    const [mine, theirs] = roomView(room(), 30 * MINUTE).wishes;
    expect(mine).toMatchObject({ id: 'w2', mine: true, canDelete: true, canReport: false, authorName: '' });
    expect(theirs).toMatchObject({ id: 'w1', mine: false, canDelete: false, canReport: true, authorName: 'An' });
    const asHost = roomView(room({ meId: 'm-host' }), 30 * MINUTE).wishes;
    expect(asHost.every((wish) => wish.canDelete)).toBe(true);
    const reported = roomView(room({ myReportedWishId: 'w1' }), 30 * MINUTE).wishes;
    expect(reported.find((wish) => wish.id === 'w1')).toMatchObject({ reportedByMe: true, canReport: false });
  });

  it('turns to ashes as soon as the last stick is out, before the server says so', () => {
    const view = roomView(room(), 70 * MINUTE);
    expect(view).toMatchObject({ status: 'ashes', wishes: [], canLight: false, minutesLeft: null, burning: 0 });
  });

  it('measures the clock offset of a device', () => {
    expect(clockOffset(room({ serverNow: 5000 }), 3000)).toBe(2000);
  });
});

describe('wishFeedback and errorKey', () => {
  it('says why a wish would be refused, but not for an empty box', () => {
    expect(wishFeedback('')).toMatchObject({ sendable: false, reasonKey: null, length: 0 });
    expect(wishFeedback('gọi 0912345678')).toMatchObject({ sendable: false, reasonKey: 'reason.phone' });
    expect(wishFeedback('Qua môn nha')).toMatchObject({ sendable: true, reasonKey: null, length: 11 });
  });

  it('maps API errors to words', () => {
    expect(errorKey({ kind: 'room', code: 'room-full' })).toBe('error.room-full');
    expect(errorKey({ kind: 'room', code: 'wish-rejected', reason: 'money' })).toBe('reason.money');
    expect(errorKey({ kind: 'offline' })).toBe('error.offline');
  });
});

describe('roomSessionReducer', () => {
  it('goes live on the first snapshot and never steps back to an older one', () => {
    const live = roomSessionReducer(INITIAL_ROOM_SESSION, { type: 'snapshot', snapshot: room({ serverNow: 2000 }), receivedAt: 1000 });
    expect(live).toMatchObject({ phase: 'live', offset: 1000, mode: 'connecting' });
    const older = roomSessionReducer(live, { type: 'snapshot', snapshot: room({ serverNow: 1500, litTotal: 9 }), receivedAt: 1600 });
    expect(older).toBe(live);
    const newer = roomSessionReducer(live, { type: 'snapshot', snapshot: room({ serverNow: 3000, litTotal: 3 }), receivedAt: 2500 });
    expect(newer).toMatchObject({ phase: 'live', offset: 500 });
    expect(roomSessionReducer(newer, { type: 'mode', mode: 'live' })).toMatchObject({ mode: 'live' });
  });

  it('keeps the last snapshot when the room goes, and fails only while joining', () => {
    expect(roomSessionReducer(INITIAL_ROOM_SESSION, { type: 'failed', error: { kind: 'offline' } })).toEqual({ phase: 'failed', error: { kind: 'offline' } });
    const live = roomSessionReducer(INITIAL_ROOM_SESSION, { type: 'snapshot', snapshot: room(), receivedAt: 30 * MINUTE });
    expect(roomSessionReducer(live, { type: 'failed', error: { kind: 'offline' } })).toBe(live);
    const gone = roomSessionReducer(live, { type: 'gone', error: null });
    expect(gone).toMatchObject({ phase: 'gone', snapshot: room(), error: null });
    expect(roomSessionReducer(gone, { type: 'snapshot', snapshot: room(), receivedAt: 0 })).toBe(gone);
  });
});
