/** The in-memory shape of a shared incense room, its small pure rules, and how viewers see it (the wire `RoomSnapshot`). */
import { ROOM_ASHES_GRACE_MS, ROOM_IDLE_TTL_MS, type RoomCreateInput, type RoomErrorCode, type RoomSnapshot, type WishRejection } from '@chuanho/contract';

/** A refused room action; the routes map `code` to an HTTP status. */
export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    readonly reason?: WishRejection,
  ) {
    super(code);
    this.name = 'RoomError';
  }
}

export interface Member {
  /** Opaque id inside the room (never the account id: members only see each other's room ids). */
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  stick: { readonly litAt: number; readonly burnsOutAt: number } | null;
  wishCount: number;
  lastWishAt: number | null;
  /** The wish this member reported while it is still up; cleared when that wish goes, so the right comes back. */
  reportedWishId: string | null;
}

export interface Wish {
  readonly id: string;
  readonly memberId: string;
  readonly text: string;
  readonly at: number;
  reports: number;
}

export interface Room {
  readonly code: string;
  readonly input: RoomCreateInput;
  hostMemberId: string;
  locked: boolean;
  /** Members by account id, in the order they came in. */
  readonly members: Map<string, Member>;
  /**
   * Members who left, by account id. Rejoining restores the same record, so leaving and coming back neither relights
   * a stick (`litTotal` and milestones stay honest; a stick still burning is kept), nor resets the wish count, nor
   * gives a second report.
   */
  readonly departed: Map<string, Member>;
  /** Account ids the host removed: kept out of this room until it is deleted (leaving and joining do not clear it). */
  readonly removed: Set<string>;
  wishes: Wish[];
  litTotal: number;
  lastActivityAt: number;
  /** When the last stick burnt out (wishes are deleted then), or null while the room is open. */
  ashesAt: number | null;
}

/** A room past its ashes grace, or one where no stick burns and nothing happened for the idle time. */
export function isExpired(room: Room, now: number): boolean {
  if (room.ashesAt !== null) return now >= room.ashesAt + ROOM_ASHES_GRACE_MS;
  const anyStick = [...room.members.values()].some((member) => member.stick !== null);
  return !anyStick && now >= room.lastActivityAt + ROOM_IDLE_TTL_MS;
}

/** Removes the wishes `gone` picks, and gives back the report right of everyone who reported one of them. */
export function removeWishes(room: Room, gone: (wish: Wish) => boolean): void {
  const removed = new Set(room.wishes.filter(gone).map((wish) => wish.id));
  if (removed.size === 0) return;
  room.wishes = room.wishes.filter((wish) => !removed.has(wish.id));
  for (const member of [...room.members.values(), ...room.departed.values()]) {
    if (member.reportedWishId !== null && removed.has(member.reportedWishId)) member.reportedWishId = null;
  }
}

/** The part of a snapshot every viewer shares. */
export type SharedRoomSnapshot = Omit<RoomSnapshot, 'meId' | 'myReportedWishId'>;
/** The part that depends on who is looking. */
export type ViewerFields = Pick<RoomSnapshot, 'meId' | 'myReportedWishId'>;

export function sharedSnapshot(room: Room, now: number): SharedRoomSnapshot {
  return {
    code: room.code,
    name: room.input.name,
    theme: room.input.theme,
    burnMinutes: room.input.burnMinutes,
    hostId: room.hostMemberId,
    locked: room.locked,
    status: room.ashesAt === null ? 'open' : 'ashes',
    members: [...room.members.values()].map(({ id, name, stick }) => ({ id, name, stick })),
    wishes: room.wishes.map(({ id, memberId, text, at, reports }) => ({ id, memberId, text, at, reports })),
    litTotal: room.litTotal,
    serverNow: now,
  };
}

export const viewerFields = (viewer: Member): ViewerFields => ({ meId: viewer.id, myReportedWishId: viewer.reportedWishId });

export const roomSnapshot = (room: Room, viewer: Member, now: number): RoomSnapshot => ({ ...sharedSnapshot(room, now), ...viewerFields(viewer) });
