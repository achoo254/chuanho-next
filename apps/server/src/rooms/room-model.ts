/** The in-memory shape of a shared incense room, and how one viewer sees it (the wire `RoomSnapshot`). */
import type { RoomCreateInput, RoomErrorCode, RoomSnapshot, WishRejection } from '@chuanho/contract';

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
  wishes: Wish[];
  litTotal: number;
  lastActivityAt: number;
  /** When the last stick burnt out (wishes are deleted then), or null while the room is open. */
  ashesAt: number | null;
}

export function roomSnapshot(room: Room, viewer: Member, now: number): RoomSnapshot {
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
    meId: viewer.id,
    myReportedWishId: viewer.reportedWishId,
    serverNow: now,
  };
}
