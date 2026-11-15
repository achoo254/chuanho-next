/**
 * What members may do with wishes in a room they are in: add one (filter and per-member limits), delete one (host or
 * author), report one (one live report per member). Plain functions on the room model; RoomStore finds the room and
 * the member, settles the room, and returns the snapshot.
 */
import { ROOM_REPORTS_TO_HIDE, ROOM_WISHES_PER_MEMBER, ROOM_WISH_INTERVAL_MS, checkWish } from '@chuanho/contract';
import { type Member, type Room, RoomError, type Wish, removeWishes } from './room-model';

function wishOf(room: Room, wishId: string): Wish {
  const wish = room.wishes.find((candidate) => candidate.id === wishId);
  if (!wish) throw new RoomError('wish-not-found');
  return wish;
}

/** Adds a wish after the filter (authoritative here) and the per-member limits. */
export function addWish(room: Room, member: Member, raw: string, now: number, id: string): void {
  const checked = checkWish(raw);
  if (!checked.ok) throw new RoomError('wish-rejected', checked.reason);
  if (member.wishCount >= ROOM_WISHES_PER_MEMBER) throw new RoomError('wish-limit');
  if (member.lastWishAt !== null && now - member.lastWishAt < ROOM_WISH_INTERVAL_MS) throw new RoomError('wish-too-fast');
  room.wishes.push({ id, memberId: member.id, text: checked.text, at: now, reports: 0 });
  member.wishCount += 1;
  member.lastWishAt = now;
  room.lastActivityAt = now;
}

/** The host may delete any wish, an author their own. */
export function deleteWish(room: Room, member: Member, wishId: string): void {
  const wish = wishOf(room, wishId);
  if (wish.memberId !== member.id && room.hostMemberId !== member.id) throw new RoomError('not-allowed');
  removeWishes(room, (other) => other.id === wish.id);
}

/**
 * One live report per account per room (the member record survives leave and rejoin); enough reports take the wish
 * down. The right comes back once the wish it was spent on is gone. Only a count is kept on the wish, never who or what;
 * the returned log line carries no wish text.
 */
export function reportWish(room: Room, member: Member, wishId: string): string {
  const wish = wishOf(room, wishId);
  if (wish.memberId === member.id) throw new RoomError('own-wish');
  if (member.reportedWishId !== null) throw new RoomError('already-reported');
  member.reportedWishId = wish.id;
  wish.reports += 1;
  const takenDown = wish.reports >= ROOM_REPORTS_TO_HIDE;
  if (takenDown) removeWishes(room, (other) => other.id === wish.id);
  return `room wish reported: ${wish.reports}/${ROOM_REPORTS_TO_HIDE}${takenDown ? ', taken down' : ''}`;
}
