/**
 * The shared incense rooms, kept in memory only: a room and every wish in it live as long as its incense and are
 * forgotten after (nothing is written to the database, nothing survives a restart). The store holds the rules (who may
 * do what, the limits, the burn-out); the routes only translate HTTP. Time and ids come from outside, so every rule is
 * tested on a clock the test moves.
 */
import {
  ROOM_ASHES_GRACE_MS,
  ROOM_IDLE_TTL_MS,
  ROOM_MAX_MEMBERS,
  ROOM_OPEN_ROOMS_PER_USER,
  ROOM_REPORTS_TO_HIDE,
  ROOM_WISHES_PER_MEMBER,
  ROOM_WISH_INTERVAL_MS,
  type RoomCreateInput,
  type RoomSnapshot,
  checkWish,
  roomStatus,
} from '@chuanho/contract';
import { type Member, type Room, RoomError, type Wish, roomSnapshot } from './room-model';

export interface RoomStoreOptions {
  readonly now: () => number;
  /** A fresh opaque id for members and wishes. */
  readonly newId: () => string;
  /** A random room code (ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH); retried on a clash. */
  readonly newCode: () => string;
  /** Rooms that just turned to ashes (to push) or were deleted (to close their streams), after any sweep. */
  readonly onSweep?: (result: SweepResult) => void;
  /** Moderation log line; never given wish text. */
  readonly log?: (line: string) => void;
}

export interface SweepResult {
  readonly turnedToAshes: readonly string[];
  readonly purged: readonly string[];
}

const CODE_ATTEMPTS = 20;

export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly options: RoomStoreOptions) {}

  create(userId: string, name: string, input: RoomCreateInput): RoomSnapshot {
    this.sweep();
    const hosting = [...this.rooms.values()].filter((room) => room.ashesAt === null && this.hostOf(room)?.userId === userId).length;
    if (hosting >= ROOM_OPEN_ROOMS_PER_USER) throw new RoomError('too-many-rooms');
    const code = this.unusedCode();
    const host = this.newMember(userId, name);
    const room: Room = {
      code,
      input,
      hostMemberId: host.id,
      locked: false,
      members: new Map([[userId, host]]),
      wishes: [],
      litTotal: 0,
      lastActivityAt: this.options.now(),
      ashesAt: null,
    };
    this.rooms.set(code, room);
    return this.view(room, host);
  }

  /** Joins (or re-enters) a room; an existing member always gets back in, even when it is locked, full or in ashes. */
  join(code: string, userId: string, name: string): RoomSnapshot {
    const room = this.room(code);
    const existing = room.members.get(userId);
    if (existing) return this.view(room, existing);
    if (room.ashesAt !== null) throw new RoomError('room-ashes');
    if (room.locked) throw new RoomError('room-locked');
    if (room.members.size >= ROOM_MAX_MEMBERS) throw new RoomError('room-full');
    const member = this.newMember(userId, name);
    room.members.set(userId, member);
    room.lastActivityAt = this.options.now();
    return this.view(room, member);
  }

  /** Leaves: the member, their stick and their wishes go; the earliest member left becomes host; empty rooms close. */
  leave(code: string, userId: string): void {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    room.members.delete(userId);
    room.wishes = room.wishes.filter((wish) => wish.memberId !== member.id);
    const next = room.members.values().next();
    if (next.done) {
      this.rooms.delete(code);
      this.options.onSweep?.({ turnedToAshes: [], purged: [code] });
      return;
    }
    if (room.hostMemberId === member.id) room.hostMemberId = next.value.id;
    this.settle(room);
  }

  light(code: string, userId: string): RoomSnapshot {
    const { room, member } = this.openRoomMember(code, userId);
    if (member.stick) throw new RoomError('already-lit');
    const now = this.options.now();
    member.stick = { litAt: now, burnsOutAt: now + room.input.burnMinutes * 60_000 };
    room.litTotal += 1;
    room.lastActivityAt = now;
    return this.view(room, member);
  }

  /** Adds a wish after the filter (authoritative here) and the per-member limits. */
  addWish(code: string, userId: string, raw: string): RoomSnapshot {
    const { room, member } = this.openRoomMember(code, userId);
    const checked = checkWish(raw);
    if (!checked.ok) throw new RoomError('wish-rejected', checked.reason);
    if (member.wishCount >= ROOM_WISHES_PER_MEMBER) throw new RoomError('wish-limit');
    const now = this.options.now();
    if (member.lastWishAt !== null && now - member.lastWishAt < ROOM_WISH_INTERVAL_MS) throw new RoomError('wish-too-fast');
    room.wishes.push({ id: this.options.newId(), memberId: member.id, text: checked.text, at: now, reports: 0 });
    member.wishCount += 1;
    member.lastWishAt = now;
    room.lastActivityAt = now;
    return this.view(room, member);
  }

  /** The host may delete any wish, an author their own. */
  deleteWish(code: string, userId: string, wishId: string): RoomSnapshot {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    const wish = this.wishOf(room, wishId);
    if (wish.memberId !== member.id && room.hostMemberId !== member.id) throw new RoomError('not-allowed');
    room.wishes = room.wishes.filter((other) => other.id !== wish.id);
    return this.view(room, member);
  }

  /** One report per member per room; enough reports take the wish down. Only a count is kept, never who or what. */
  report(code: string, userId: string, wishId: string): RoomSnapshot {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    const wish = this.wishOf(room, wishId);
    if (wish.memberId === member.id) throw new RoomError('own-wish');
    if (member.reportedWishId !== null) throw new RoomError('already-reported');
    member.reportedWishId = wish.id;
    wish.reports += 1;
    const takenDown = wish.reports >= ROOM_REPORTS_TO_HIDE;
    if (takenDown) room.wishes = room.wishes.filter((other) => other.id !== wish.id);
    this.options.log?.(`room wish reported: ${wish.reports}/${ROOM_REPORTS_TO_HIDE}${takenDown ? ', taken down' : ''}`);
    return this.view(room, member);
  }

  /** Host only: a locked room lets nobody new in. */
  setLocked(code: string, userId: string, locked: boolean): RoomSnapshot {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    if (room.hostMemberId !== member.id) throw new RoomError('not-allowed');
    room.locked = locked;
    return this.view(room, member);
  }

  /** The room as `userId` sees it; refused to anyone who is not in it. */
  snapshot(code: string, userId: string): RoomSnapshot {
    const room = this.room(code);
    return this.view(room, this.memberOf(room, userId));
  }

  /** `snapshot` without sweeping, or null when the room is gone or the account left (for pushing to open streams). */
  snapshotOrNull(code: string, userId: string): RoomSnapshot | null {
    const room = this.rooms.get(code);
    const member = room?.members.get(userId);
    return room && member ? this.view(room, member) : null;
  }

  /** Turns burnt-out rooms to ashes (wishes deleted) and deletes rooms past their grace or idle time. */
  sweep(): SweepResult {
    const now = this.options.now();
    const turnedToAshes: string[] = [];
    const purged: string[] = [];
    for (const room of this.rooms.values()) {
      if (this.settle(room)) turnedToAshes.push(room.code);
      const ashesOver = room.ashesAt !== null && now >= room.ashesAt + ROOM_ASHES_GRACE_MS;
      const anyStick = [...room.members.values()].some((member) => member.stick !== null);
      const idle = !anyStick && now >= room.lastActivityAt + ROOM_IDLE_TTL_MS;
      if (ashesOver || idle) {
        this.rooms.delete(room.code);
        purged.push(room.code);
      }
    }
    const result = { turnedToAshes: turnedToAshes.filter((code) => !purged.includes(code)), purged };
    if (result.turnedToAshes.length > 0 || purged.length > 0) this.options.onSweep?.(result);
    return result;
  }

  /** Rooms in memory. */
  get size(): number {
    return this.rooms.size;
  }

  /** Marks a room whose last stick burnt out as ashes and deletes its wishes; true when that just happened. */
  private settle(room: Room): boolean {
    if (room.ashesAt !== null) return false;
    const members = [...room.members.values()];
    if (roomStatus(members, this.options.now()) !== 'ashes') return false;
    room.ashesAt = Math.max(...members.map((member) => member.stick?.burnsOutAt ?? 0));
    room.wishes = [];
    return true;
  }

  /** A live room by code, settled to the current time; `room-not-found` for an unknown or expired one. */
  private room(code: string): Room {
    this.sweep();
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('room-not-found');
    return room;
  }

  private hostOf(room: Room): Member | undefined {
    return [...room.members.values()].find((member) => member.id === room.hostMemberId);
  }

  private memberOf(room: Room, userId: string): Member {
    const member = room.members.get(userId);
    if (!member) throw new RoomError('not-member');
    return member;
  }

  private wishOf(room: Room, wishId: string): Wish {
    const wish = room.wishes.find((candidate) => candidate.id === wishId);
    if (!wish) throw new RoomError('wish-not-found');
    return wish;
  }

  private openRoomMember(code: string, userId: string): { room: Room; member: Member } {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    if (room.ashesAt !== null) throw new RoomError('room-ashes');
    return { room, member };
  }

  private newMember(userId: string, name: string): Member {
    return { id: this.options.newId(), userId, name, stick: null, wishCount: 0, lastWishAt: null, reportedWishId: null };
  }

  private unusedCode(): string {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const code = this.options.newCode();
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('no free room code');
  }

  private view(room: Room, viewer: Member): RoomSnapshot {
    return roomSnapshot(room, viewer, this.options.now());
  }
}
