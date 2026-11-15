/**
 * What the room screen shows, derived from a snapshot and the server's time now: each stick's burn, the countdown,
 * the smoke and milestone, who may delete or report which wish, and the words for an API error. Pure; the server's
 * clock comes in as `serverNow` (device time plus the offset measured from the snapshots), so a device with a wrong
 * clock still burns the sticks right.
 */
import { type RoomSnapshot, WISH_MAX, checkWish, milestoneFor, roomStatus, smokeLevel, stickState } from '@chuanho/contract';
import type { RoomApiError } from './room-api';
import type { RoomTextKey } from './room-messages';

export interface StickView {
  readonly progress: number;
  readonly minutesLeft: number;
  readonly burntOut: boolean;
}

export interface MemberView {
  readonly id: string;
  /** Empty when the account has no name; the screen says "a friend". */
  readonly name: string;
  readonly isMe: boolean;
  readonly isHost: boolean;
  readonly stick: StickView | null;
  /** The viewer is the host and this is someone else: the host may remove them from the room. */
  readonly canRemove: boolean;
}

export interface WishView {
  readonly id: string;
  readonly text: string;
  readonly authorName: string;
  readonly mine: boolean;
  readonly canDelete: boolean;
  readonly canReport: boolean;
  readonly reportedByMe: boolean;
  readonly reports: number;
}

export interface RoomView {
  readonly status: 'open' | 'ashes';
  readonly isHost: boolean;
  readonly members: readonly MemberView[];
  readonly me: MemberView | null;
  readonly burning: number;
  /** Minutes until the last burning stick is out, or null when none burns. */
  readonly minutesLeft: number | null;
  readonly smoke: number;
  readonly milestone: number;
  /** Newest first. */
  readonly wishes: readonly WishView[];
  readonly canLight: boolean;
}

/** How far the server's clock is ahead of this device's, from a snapshot received at device time `receivedAt`. */
export const clockOffset = (snapshot: RoomSnapshot, receivedAt: number): number => snapshot.serverNow - receivedAt;

export function roomView(snapshot: RoomSnapshot, serverNow: number): RoomView {
  const status = snapshot.status === 'ashes' || roomStatus(snapshot.members, serverNow) === 'ashes' ? 'ashes' : 'open';
  const isHost = snapshot.hostId === snapshot.meId;
  const members = snapshot.members.map((member) => ({
    id: member.id,
    name: member.name,
    isMe: member.id === snapshot.meId,
    isHost: member.id === snapshot.hostId,
    stick: member.stick ? stickState(member.stick, serverNow) : null,
    canRemove: isHost && member.id !== snapshot.meId,
  }));
  const burningSticks = members.flatMap((member) => (member.stick && !member.stick.burntOut ? [member.stick] : []));
  const names = new Map(members.map((member) => [member.id, member.name]));
  const wishes = [...snapshot.wishes].reverse().map((wish) => {
    const mine = wish.memberId === snapshot.meId;
    const reportedByMe = snapshot.myReportedWishId === wish.id;
    return {
      id: wish.id,
      text: wish.text,
      authorName: names.get(wish.memberId) ?? '',
      mine,
      canDelete: mine || isHost,
      canReport: !mine && snapshot.myReportedWishId === null,
      reportedByMe,
      reports: wish.reports,
    };
  });
  const me = members.find((member) => member.isMe) ?? null;
  return {
    status,
    isHost,
    members,
    me,
    burning: burningSticks.length,
    minutesLeft: burningSticks.length > 0 ? Math.max(...burningSticks.map((stick) => stick.minutesLeft)) : null,
    smoke: smokeLevel(snapshot.members, serverNow),
    milestone: milestoneFor(snapshot.litTotal),
    wishes: status === 'ashes' ? [] : wishes,
    canLight: status === 'open' && me !== null && me.stick === null,
  };
}

/** Live feedback while typing: the counter and, once there is something to judge, why it would be refused. */
export function wishFeedback(text: string): { readonly length: number; readonly max: number; readonly sendable: boolean; readonly reasonKey: RoomTextKey | null } {
  const checked = checkWish(text);
  const reasonKey = checked.ok || checked.reason === 'empty' ? null : (`reason.${checked.reason}` as const);
  return { length: text.trim().length, max: WISH_MAX, sendable: checked.ok, reasonKey };
}

/**
 * A room ending the panel handles itself instead of showing "the room has closed": a lost session (sign in again), or
 * the host removing the player (back to the lobby with a gentle word).
 */
export const endsInLobby = (error: RoomApiError | null): error is RoomApiError =>
  error !== null && (error.kind === 'signed-out' || (error.kind === 'room' && error.code === 'removed'));

/** The words for an API error. */
export function errorKey(error: RoomApiError): RoomTextKey {
  switch (error.kind) {
    case 'room':
      return error.code === 'wish-rejected' && error.reason ? `reason.${error.reason}` : `error.${error.code}`;
    case 'rate-limited':
      return 'error.rate-limited';
    case 'offline':
      return 'error.offline';
    case 'signed-out':
      return 'signInNeeded';
    case 'server':
      return 'error.server';
  }
}
