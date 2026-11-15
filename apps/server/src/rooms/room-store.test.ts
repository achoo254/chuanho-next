/** The room rules on a clock the test moves: limits, roles, reports, burn-out to ashes and deletion. */
import {
  ROOM_ASHES_GRACE_MS,
  ROOM_IDLE_TTL_MS,
  ROOM_MAX_MEMBERS,
  ROOM_OPEN_ROOMS_PER_USER,
  ROOM_REPORTS_TO_HIDE,
  ROOM_WISHES_PER_MEMBER,
  ROOM_WISH_INTERVAL_MS,
  type RoomCreateInput,
} from '@chuanho/contract';
import { beforeEach, describe, expect, it } from 'vitest';
import { RoomError } from './room-model';
import { RoomStore, type SweepResult } from './room-store';

const MINUTE = 60_000;
const INPUT: RoomCreateInput = { name: 'Giải nghiệp phòng PTPM', theme: 'deadline', burnMinutes: 30 };

let clock: number;
let store: RoomStore;
let sweeps: SweepResult[];
let logs: string[];

beforeEach(() => {
  clock = 1_000_000;
  let ids = 0;
  let codes = 0;
  sweeps = [];
  logs = [];
  store = new RoomStore({
    now: () => clock,
    newId: () => `id-${(ids += 1)}`,
    newCode: () => `ROOM${(codes += 1)}A`.slice(0, 6).padEnd(6, 'A'),
    onSweep: (result) => sweeps.push(result),
    log: (line) => logs.push(line),
  });
});

/** The error code a call is refused with. */
function refusal(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    if (error instanceof RoomError) return error.reason ? `${error.code}:${error.reason}` : error.code;
    throw error;
  }
  throw new Error('expected a refusal');
}

describe('RoomStore', () => {
  it('creates a room with its host inside, and lets others join by code', () => {
    const created = store.create('u-host', 'An', INPUT);
    expect(created).toMatchObject({ name: INPUT.name, theme: 'deadline', burnMinutes: 30, locked: false, status: 'open', litTotal: 0, wishes: [] });
    expect(created.hostId).toBe(created.meId);
    const joined = store.join(created.code, 'u-2', 'Bình');
    expect(joined.members.map((m) => m.name)).toEqual(['An', 'Bình']);
    expect(joined.meId).not.toBe(created.meId);
    // Joining again is just coming back.
    expect(store.join(created.code, 'u-2', 'Bình').meId).toBe(joined.meId);
    expect(refusal(() => store.join('NOPE22', 'u-2', 'Bình'))).toBe('room-not-found');
    expect(refusal(() => store.snapshot(created.code, 'u-stranger'))).toBe('not-member');
  });

  it('caps open rooms per host and members per room', () => {
    for (let i = 0; i < ROOM_OPEN_ROOMS_PER_USER; i += 1) store.create('u-busy', 'An', INPUT);
    expect(refusal(() => store.create('u-busy', 'An', INPUT))).toBe('too-many-rooms');
    const { code } = store.create('u-other', 'Chi', INPUT);
    for (let i = 1; i < ROOM_MAX_MEMBERS; i += 1) store.join(code, `u-m${i}`, 'X');
    expect(refusal(() => store.join(code, 'u-late', 'Late'))).toBe('room-full');
  });

  it('lets only the host lock, and a locked room lets nobody new in', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    store.join(code, 'u-2', 'Bình');
    expect(refusal(() => store.setLocked(code, 'u-2', true))).toBe('not-allowed');
    expect(store.setLocked(code, 'u-host', true).locked).toBe(true);
    expect(refusal(() => store.join(code, 'u-3', 'Chi'))).toBe('room-locked');
    expect(store.join(code, 'u-2', 'Bình').locked).toBe(true);
    expect(store.setLocked(code, 'u-host', false).locked).toBe(false);
    expect(store.join(code, 'u-3', 'Chi').members).toHaveLength(3);
  });

  it('lets only the host remove someone else, never themself', () => {
    const { code, meId: hostId } = store.create('u-host', 'An', INPUT);
    const guest = store.join(code, 'u-2', 'Bình');
    const third = store.join(code, 'u-3', 'Chi');
    expect(refusal(() => store.removeMember(code, 'u-2', third.meId))).toBe('not-allowed');
    expect(refusal(() => store.removeMember(code, 'u-host', hostId))).toBe('cannot-remove-self');
    expect(refusal(() => store.removeMember(code, 'u-host', 'id-unknown'))).toBe('not-member');
    expect(refusal(() => store.removeMember(code, 'u-stranger', guest.meId))).toBe('not-member');
    const { snapshot, removedUserId } = store.removeMember(code, 'u-host', guest.meId);
    expect(removedUserId).toBe('u-2');
    expect(snapshot.meId).toBe(hostId);
    expect(snapshot.members.map((m) => m.name)).toEqual(['An', 'Chi']);
    expect(logs.at(-1)).toBe('room member removed by host');
  });

  it('keeps a removed member stick in the count, drops their wishes and keeps them out for good', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    const guest = store.join(code, 'u-2', 'Bình');
    store.light(code, 'u-host');
    store.light(code, 'u-2');
    store.addWish(code, 'u-2', 'Cho sprint êm');
    const kept = store.addWish(code, 'u-host', 'Deadline lùi giùm').wishes;
    expect(kept).toHaveLength(2);
    const after = store.removeMember(code, 'u-host', guest.meId).snapshot;
    expect(after.litTotal).toBe(2);
    expect(after.members.some((m) => m.id === guest.meId)).toBe(false);
    expect(after.wishes.map((w) => w.memberId)).toEqual([after.meId]);
    // Out of the room for every action, and back in neither directly, after leaving, nor once the room is unlocked.
    expect(refusal(() => store.snapshot(code, 'u-2'))).toBe('removed');
    expect(refusal(() => store.light(code, 'u-2'))).toBe('removed');
    expect(refusal(() => store.leave(code, 'u-2'))).toBe('removed');
    expect(refusal(() => store.join(code, 'u-2', 'Bình'))).toBe('removed');
    store.setLocked(code, 'u-host', true);
    expect(refusal(() => store.join(code, 'u-2', 'Bình'))).toBe('removed');
    expect(refusal(() => store.join(code, 'u-3', 'Chi'))).toBe('room-locked');
    store.setLocked(code, 'u-host', false);
    expect(refusal(() => store.join(code, 'u-2', 'Bình'))).toBe('removed');
    // Nobody else is affected, and the count never grows from the removal.
    const third = store.join(code, 'u-3', 'Chi');
    expect(third.litTotal).toBe(2);
    expect(third.members.map((m) => m.name)).toEqual(['An', 'Chi']);
  });

  it('forgets who was removed once the room is deleted', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    const guest = store.join(code, 'u-2', 'Bình');
    store.removeMember(code, 'u-host', guest.meId);
    store.leave(code, 'u-host');
    expect(store.size).toBe(0);
    expect(refusal(() => store.join(code, 'u-2', 'Bình'))).toBe('room-not-found');
    const next = store.create('u-host', 'An', INPUT);
    expect(store.join(next.code, 'u-2', 'Bình').members).toHaveLength(2);
  });

  it('turns to ashes when the removed member held the only stick still burning', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    const guest = store.join(code, 'u-2', 'Bình');
    store.light(code, 'u-host');
    clock += 10 * MINUTE;
    store.light(code, 'u-2');
    clock += 25 * MINUTE;
    expect(store.snapshot(code, 'u-host').status).toBe('open');
    expect(store.removeMember(code, 'u-host', guest.meId).snapshot).toMatchObject({ status: 'ashes', litTotal: 2 });
  });

  it('lights one stick per member that burns for the chosen minutes', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    const lit = store.light(code, 'u-host');
    expect(lit.members[0]?.stick).toEqual({ litAt: clock, burnsOutAt: clock + 30 * MINUTE });
    expect(lit.litTotal).toBe(1);
    expect(refusal(() => store.light(code, 'u-host'))).toBe('already-lit');
  });

  it('filters wishes on the server and limits how often and how many', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    expect(refusal(() => store.addWish(code, 'u-host', 'gọi 0912 345 678'))).toBe('wish-rejected:phone');
    expect(refusal(() => store.addWish(code, 'u-host', 'chuyển khoản nha'))).toBe('wish-rejected:money');
    expect(store.addWish(code, 'u-host', '  Deadline lùi giùm  ').wishes[0]?.text).toBe('Deadline lùi giùm');
    expect(refusal(() => store.addWish(code, 'u-host', 'Thêm một câu'))).toBe('wish-too-fast');
    for (let i = 1; i < ROOM_WISHES_PER_MEMBER; i += 1) {
      clock += ROOM_WISH_INTERVAL_MS;
      store.addWish(code, 'u-host', `Lời nguyện số ${i}`);
    }
    clock += ROOM_WISH_INTERVAL_MS;
    expect(refusal(() => store.addWish(code, 'u-host', 'Câu thứ sáu'))).toBe('wish-limit');
  });

  it('lets authors delete their own wishes and the host any', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    store.join(code, 'u-2', 'Bình');
    store.join(code, 'u-3', 'Chi');
    const first = store.addWish(code, 'u-2', 'Qua môn nha').wishes[0];
    if (!first) throw new Error('no wish');
    expect(refusal(() => store.deleteWish(code, 'u-3', first.id))).toBe('not-allowed');
    expect(store.deleteWish(code, 'u-host', first.id).wishes).toEqual([]);
    const own = store.addWish(code, 'u-3', 'Ngủ đủ giấc').wishes[0];
    if (!own) throw new Error('no wish');
    expect(store.deleteWish(code, 'u-3', own.id).wishes).toEqual([]);
    expect(refusal(() => store.deleteWish(code, 'u-3', own.id))).toBe('wish-not-found');
  });

  it('takes one report per member and takes a wish down after enough of them, logging no text', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    for (let i = 1; i <= ROOM_REPORTS_TO_HIDE + 1; i += 1) store.join(code, `u-${i}`, `M${i}`);
    const wish = store.addWish(code, 'u-1', 'Lời nguyện bí mật').wishes[0];
    if (!wish) throw new Error('no wish');
    expect(refusal(() => store.report(code, 'u-1', wish.id))).toBe('own-wish');
    const reported = store.report(code, 'u-2', wish.id);
    expect(reported.myReportedWishId).toBe(wish.id);
    expect(reported.wishes[0]?.reports).toBe(1);
    expect(refusal(() => store.report(code, 'u-2', wish.id))).toBe('already-reported');
    for (let i = 3; i <= ROOM_REPORTS_TO_HIDE + 1; i += 1) store.report(code, `u-${i}`, wish.id);
    expect(store.snapshot(code, 'u-host').wishes).toEqual([]);
    expect(logs.join('\n')).not.toContain('bí mật');
    expect(logs.at(-1)).toContain('taken down');
  });

  it('keeps a stick, the wish count and a report across leave and rejoin', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    store.join(code, 'u-2', 'Bình');
    store.light(code, 'u-2');
    const wish = store.addWish(code, 'u-host', 'Cho sprint êm').wishes[0];
    if (!wish) throw new Error('no wish');
    store.report(code, 'u-2', wish.id);
    for (let i = 1; i < ROOM_WISHES_PER_MEMBER; i += 1) {
      clock += ROOM_WISH_INTERVAL_MS;
      store.addWish(code, 'u-2', `Lời nguyện số ${i}`);
    }
    store.leave(code, 'u-2');
    clock += 5 * MINUTE;
    const back = store.join(code, 'u-2', 'Bình mới');
    const me = back.members.find((member) => member.id === back.meId);
    expect(me).toMatchObject({ name: 'Bình mới', stick: { litAt: 1_000_000, burnsOutAt: 1_000_000 + 30 * MINUTE } });
    expect(back.litTotal).toBe(1);
    expect(back.myReportedWishId).toBe(wish.id);
    expect(refusal(() => store.light(code, 'u-2'))).toBe('already-lit');
    clock += ROOM_WISH_INTERVAL_MS;
    store.addWish(code, 'u-2', 'Lời nguyện cuối');
    clock += ROOM_WISH_INTERVAL_MS;
    expect(refusal(() => store.addWish(code, 'u-2', 'Thêm nữa'))).toBe('wish-limit');
    expect(refusal(() => store.report(code, 'u-2', wish.id))).toBe('already-reported');
    expect(store.snapshot(code, 'u-host').wishes.find((w) => w.id === wish.id)?.reports).toBe(1);
  });

  it('gives a report right back once the reported wish is gone', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    store.join(code, 'u-2', 'Bình');
    const first = store.addWish(code, 'u-host', 'Câu một').wishes[0];
    clock += ROOM_WISH_INTERVAL_MS;
    const second = store.addWish(code, 'u-host', 'Câu hai').wishes[1];
    if (!first || !second) throw new Error('no wish');
    store.report(code, 'u-2', first.id);
    expect(refusal(() => store.report(code, 'u-2', second.id))).toBe('already-reported');
    expect(store.deleteWish(code, 'u-host', first.id).wishes.map((w) => w.id)).toEqual([second.id]);
    expect(store.snapshot(code, 'u-2').myReportedWishId).toBeNull();
    expect(store.report(code, 'u-2', second.id).myReportedWishId).toBe(second.id);
  });

  it('settles only the room a request touches; the timer sweep walks the rest', () => {
    const a = store.create('u-host', 'An', INPUT).code;
    const b = store.create('u-other', 'Chi', INPUT).code;
    clock += ROOM_IDLE_TTL_MS;
    expect(refusal(() => store.snapshot(a, 'u-host'))).toBe('room-not-found');
    expect(sweeps).toEqual([{ turnedToAshes: [], purged: [a] }]);
    expect(store.size).toBe(1);
    expect(store.sweep().purged).toEqual([b]);
  });

  it('turns to ashes when the last stick burns out, deleting wishes, then forgets the room', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    store.join(code, 'u-2', 'Bình');
    store.light(code, 'u-host');
    clock += 10 * MINUTE;
    store.light(code, 'u-2');
    store.addWish(code, 'u-2', 'Cho sprint êm');
    clock += 25 * MINUTE;
    // The host's stick is out, Bình's still burns.
    expect(store.snapshot(code, 'u-host').status).toBe('open');
    clock += 10 * MINUTE;
    const ashes = store.snapshot(code, 'u-host');
    expect(ashes).toMatchObject({ status: 'ashes', wishes: [], litTotal: 2 });
    expect(sweeps).toContainEqual({ turnedToAshes: [code], purged: [] });
    expect(refusal(() => store.light(code, 'u-host'))).toBe('room-ashes');
    expect(refusal(() => store.join(code, 'u-3', 'Chi'))).toBe('room-ashes');
    clock += ROOM_ASHES_GRACE_MS;
    expect(refusal(() => store.snapshot(code, 'u-host'))).toBe('room-not-found');
    expect(sweeps.at(-1)).toEqual({ turnedToAshes: [], purged: [code] });
    expect(store.size).toBe(0);
  });

  it('forgets a room where no stick burns after the idle time', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    clock += ROOM_IDLE_TTL_MS - 1;
    expect(store.snapshot(code, 'u-host').status).toBe('open');
    clock += 1;
    expect(store.sweep().purged).toEqual([code]);
  });

  it('hands the host role on when the host leaves and closes an empty room', () => {
    const { code } = store.create('u-host', 'An', INPUT);
    const second = store.join(code, 'u-2', 'Bình');
    store.addWish(code, 'u-host', 'Bye mọi người');
    store.leave(code, 'u-host');
    const after = store.snapshot(code, 'u-2');
    expect(after.hostId).toBe(second.meId);
    expect(after.wishes).toEqual([]);
    expect(after.members).toHaveLength(1);
    store.leave(code, 'u-2');
    expect(store.size).toBe(0);
    expect(sweeps.at(-1)).toEqual({ turnedToAshes: [], purged: [code] });
  });
});
