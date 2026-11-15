/**
 * The shared incense room ("Phòng giải nghiệp"): friends or colleagues enter a private room by code, each lights an
 * incense stick that burns in real time, and leaves one short wish. The server owns the state and pushes whole
 * snapshots; everything here is plain data plus the few pure rules both sides need (stick progress, code shape).
 *
 * REST (all under `/api/rooms`, signed in): `POST /` create, `GET /:code` snapshot, `POST /:code/join`,
 * `POST /:code/leave`, `POST /:code/light`, `POST /:code/wishes` (RoomWishInput), `DELETE /:code/wishes/:id`
 * (host or author), `POST /:code/wishes/:id/report`, `POST /:code/lock` (host). Live updates: `GET /:code/events`
 * (server-sent events) sends `RoomSnapshot` as JSON in each message.
 */
import { cleanText, isRecord } from './primitives';

export const ROOM_BURN_MINUTES = [30, 60, 90] as const;
export type RoomBurnMinutes = (typeof ROOM_BURN_MINUTES)[number];
export const DEFAULT_ROOM_BURN_MINUTES: RoomBurnMinutes = 60;

export const ROOM_THEMES = ['deadline', 'overtime', 'exam', 'meeting', 'love', 'custom'] as const;
export type RoomTheme = (typeof ROOM_THEMES)[number];

export const ROOM_MAX_MEMBERS = 50;
export const ROOM_NAME_MAX = 40;
export const ROOM_OPEN_ROOMS_PER_USER = 3;
/** A room nobody lit a stick in is removed after this long. */
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;
/** Collective milestones (sticks lit) that add a purely visual effect to the burner. */
export const ROOM_MILESTONES = [10, 25, 50] as const;

/** Room codes avoid look-alike characters (no 0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const isRoomCode = (value: unknown): value is string => typeof value === 'string' && value.length === ROOM_CODE_LENGTH && [...value].every((ch) => ROOM_CODE_ALPHABET.includes(ch));

export const isRoomTheme = (value: unknown): value is RoomTheme => (ROOM_THEMES as readonly unknown[]).includes(value);
export const isBurnMinutes = (value: unknown): value is RoomBurnMinutes => (ROOM_BURN_MINUTES as readonly unknown[]).includes(value);

export interface RoomCreateInput {
  readonly name: string;
  readonly theme: RoomTheme;
  readonly burnMinutes: RoomBurnMinutes;
}

export function parseRoomCreateInput(raw: unknown): RoomCreateInput | null {
  if (!isRecord(raw)) return null;
  const name = cleanText(raw.name, ROOM_NAME_MAX, 1);
  const burnMinutes = raw.burnMinutes ?? DEFAULT_ROOM_BURN_MINUTES;
  if (name === null || !isRoomTheme(raw.theme) || !isBurnMinutes(burnMinutes)) return null;
  return { name, theme: raw.theme, burnMinutes };
}

export interface RoomMember {
  readonly id: string;
  /** A short display name (first part of the account name); never an email. */
  readonly name: string;
  /** The member's stick, or null when they have not lit one. */
  readonly stick: { readonly litAt: number; readonly burnsOutAt: number } | null;
}

export interface RoomWish {
  readonly id: string;
  readonly memberId: string;
  readonly text: string;
  readonly at: number;
}

export interface RoomSnapshot {
  readonly code: string;
  readonly name: string;
  readonly theme: RoomTheme;
  readonly burnMinutes: RoomBurnMinutes;
  readonly hostId: string;
  readonly locked: boolean;
  /** `open` while any stick burns or none was lit yet; `ashes` once every lit stick has burnt out. */
  readonly status: 'open' | 'ashes';
  readonly members: readonly RoomMember[];
  readonly wishes: readonly RoomWish[];
  /** Sticks lit so far (not reduced when sticks burn out). */
  readonly litTotal: number;
  /** Id of the viewer's own member row. */
  readonly meId: string;
  /** The server's clock at this snapshot, so devices with a wrong clock still show the right countdown. */
  readonly serverNow: number;
}

export interface RoomWishInput {
  readonly text: string;
}

/** Burn state of one stick at `now`: how far it has burnt (0..1) and the minutes left, rounded up. */
export function stickState(stick: { readonly litAt: number; readonly burnsOutAt: number }, now: number): { progress: number; minutesLeft: number; burntOut: boolean } {
  const total = Math.max(1, stick.burnsOutAt - stick.litAt);
  const progress = Math.min(1, Math.max(0, (now - stick.litAt) / total));
  return { progress, minutesLeft: Math.max(0, Math.ceil((stick.burnsOutAt - now) / 60_000)), burntOut: now >= stick.burnsOutAt };
}

/** Where the room stands: ashes only after at least one stick was lit and all of them have burnt out. */
export function roomStatus(members: readonly Pick<RoomMember, 'stick'>[], now: number): 'open' | 'ashes' {
  const sticks = members.flatMap((member) => (member.stick ? [member.stick] : []));
  return sticks.length > 0 && sticks.every((stick) => now >= stick.burnsOutAt) ? 'ashes' : 'open';
}

/** Smoke grows with the sticks still burning: 0 (none) to 1 (a dozen or more). */
export function smokeLevel(members: readonly Pick<RoomMember, 'stick'>[], now: number): number {
  const burning = members.filter((member) => member.stick && now < member.stick.burnsOutAt).length;
  return Math.min(1, burning / 12);
}

/** The highest collective milestone reached by `litTotal` sticks, or 0. */
export const milestoneFor = (litTotal: number): number => [...ROOM_MILESTONES].reverse().find((mark) => litTotal >= mark) ?? 0;
