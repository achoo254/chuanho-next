/**
 * The shared incense rooms, kept in memory only: a room and every wish in it live as long as its incense and are
 * forgotten after (nothing is written to the database, nothing survives a restart). The store holds the rules (who may
 * do what, the limits, the burn-out); the routes only translate HTTP. Time and ids come from outside, so every rule is
 * tested on a clock the test moves. A request settles only the room it touches; `sweep` (on a timer) walks them all.
 */
import { ROOM_MAX_MEMBERS, ROOM_OPEN_ROOMS_PER_USER, type RoomCreateInput, type RoomSnapshot, roomStatus } from '@chuanho/contract';
import { type Member, type Room, RoomError, type SharedRoomSnapshot, type ViewerFields, isExpired, removeWishes, roomSnapshot, sharedSnapshot, viewerFields } from './room-model';
import { addWish, deleteWish, reportWish } from './room-wish-rules';

export interface RoomStoreOptions {
  readonly now: () => number;
  /** A fresh opaque id for members and wishes. */
  readonly newId: () => string;
  /** A random room code (ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH); retried on a clash. */
  readonly newCode: () => string;
  /** Rooms that just turned to ashes (to push) or were deleted (to close their streams). */
  readonly onSweep?: (result: SweepResult) => void;
  /** Moderation log line; never given wish text. */
  readonly log?: (line: string) => void;
}

export interface SweepResult {
  readonly turnedToAshes: readonly string[];
  readonly purged: readonly string[];
}

/** One room as its event streams need it: the shared part once, the per-viewer part per stream (null: not in it). */
export interface RoomStreamView {
  readonly shared: SharedRoomSnapshot;
  viewer(userId: string): ViewerFields | null;
}

const CODE_ATTEMPTS = 20;

export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly options: RoomStoreOptions) {}

  create(userId: string, name: string, input: RoomCreateInput): RoomSnapshot {
    const now = this.options.now();
    const hosting = [...this.rooms.values()].filter(
      (room) =>
        room.ashesAt === null && !isExpired(room, now) && roomStatus([...room.members.values()], now) === 'open' && room.members.get(userId)?.id === room.hostMemberId,
    ).length;
    if (hosting >= ROOM_OPEN_ROOMS_PER_USER) throw new RoomError('too-many-rooms');
    const code = this.unusedCode();
    const host = this.newMember(userId, name);
    const room: Room = {
      code,
      input,
      hostMemberId: host.id,
      locked: false,
      members: new Map([[userId, host]]),
      departed: new Map(),
      removed: new Set(),
      wishes: [],
      litTotal: 0,
      lastActivityAt: now,
      ashesAt: null,
    };
    this.rooms.set(code, room);
    return this.view(room, host);
  }

  /**
   * Joins (or re-enters) a room; an existing member always gets back in, even when it is locked, full or in ashes. One
   * who left comes back as the same member (stick, wish count and report kept) under the same rules as a newcomer.
   * One the host removed never gets back in (`removed`).
   */
  join(code: string, userId: string, name: string): RoomSnapshot {
    const room = this.room(code);
    if (room.removed.has(userId)) throw new RoomError('removed');
    const existing = room.members.get(userId);
    if (existing) return this.view(room, existing);
    if (room.ashesAt !== null) throw new RoomError('room-ashes');
    if (room.locked) throw new RoomError('room-locked');
    if (room.members.size >= ROOM_MAX_MEMBERS) throw new RoomError('room-full');
    const former = room.departed.get(userId);
    room.departed.delete(userId);
    const member = former ? { ...former, name } : this.newMember(userId, name);
    room.members.set(userId, member);
    room.lastActivityAt = this.options.now();
    return this.view(room, member);
  }

  /** Leaves: the member's stick and wishes leave the room with them; the earliest member left becomes host; empty rooms close. */
  leave(code: string, userId: string): void {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    room.members.delete(userId);
    room.departed.set(userId, member);
    removeWishes(room, (wish) => wish.memberId === member.id);
    const next = room.members.values().next();
    if (next.done) {
      this.purge(room);
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

  addWish(code: string, userId: string, raw: string): RoomSnapshot {
    const { room, member } = this.openRoomMember(code, userId);
    addWish(room, member, raw, this.options.now(), this.options.newId());
    return this.view(room, member);
  }

  deleteWish(code: string, userId: string, wishId: string): RoomSnapshot {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    deleteWish(room, member, wishId);
    return this.view(room, member);
  }

  report(code: string, userId: string, wishId: string): RoomSnapshot {
    const room = this.room(code);
    const member = this.memberOf(room, userId);
    this.options.log?.(reportWish(room, member, wishId));
    return this.view(room, member);
  }

  /**
   * Host only: removes another member by their room id. Their stick stays counted in `litTotal` (and milestones) but
   * leaves the burner with them, their wishes are deleted, and they cannot come back into this room. Returns the host's
   * snapshot and the removed account (whose live streams the caller closes).
   */
  removeMember(code: string, userId: string, memberId: string): { readonly snapshot: RoomSnapshot; readonly removedUserId: string } {
    const room = this.room(code);
    const host = this.memberOf(room, userId);
    if (room.hostMemberId !== host.id) throw new RoomError('not-allowed');
    if (memberId === host.id) throw new RoomError('cannot-remove-self');
    const target = [...room.members.values()].find((member) => member.id === memberId);
    if (!target) throw new RoomError('not-member');
    room.members.delete(target.userId);
    room.removed.add(target.userId);
    removeWishes(room, (wish) => wish.memberId === target.id);
    this.options.log?.('room member removed by host');
    this.settle(room);
    return { snapshot: this.view(room, host), removedUserId: target.userId };
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

  /** The room for its open streams, without settling, or null when it is gone. */
  streamView(code: string): RoomStreamView | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return {
      shared: sharedSnapshot(room, this.options.now()),
      viewer: (userId) => {
        const member = room.members.get(userId);
        return member ? viewerFields(member) : null;
      },
    };
  }

  /** Turns burnt-out rooms to ashes (wishes deleted) and deletes rooms past their grace or idle time. */
  sweep(): SweepResult {
    const now = this.options.now();
    const turnedToAshes: string[] = [];
    const purged: string[] = [];
    for (const room of [...this.rooms.values()]) {
      const turned = this.settle(room);
      if (isExpired(room, now)) {
        this.rooms.delete(room.code);
        purged.push(room.code);
      } else if (turned) turnedToAshes.push(room.code);
    }
    const result = { turnedToAshes, purged };
    if (turnedToAshes.length > 0 || purged.length > 0) this.options.onSweep?.(result);
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
    removeWishes(room, () => true);
    return true;
  }

  private purge(room: Room): void {
    this.rooms.delete(room.code);
    this.options.onSweep?.({ turnedToAshes: [], purged: [room.code] });
  }

  /** A live room by code, settled to the current time; `room-not-found` for an unknown or expired one. */
  private room(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('room-not-found');
    const turned = this.settle(room);
    if (isExpired(room, this.options.now())) {
      this.purge(room);
      throw new RoomError('room-not-found');
    }
    if (turned) this.options.onSweep?.({ turnedToAshes: [room.code], purged: [] });
    return room;
  }

  /** The caller's member row; `removed` for one the host removed, `not-member` for anyone else outside. */
  private memberOf(room: Room, userId: string): Member {
    const member = room.members.get(userId);
    if (!member) throw new RoomError(room.removed.has(userId) ? 'removed' : 'not-member');
    return member;
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
