/**
 * The player's best "Hộ hương" round on this device (score and stars). Local only: the game is a calm extra, nothing
 * is shared or synced. Unreadable or tampered values count as no record.
 */
import { readStored, writeStored } from '../../game/safe-storage';

export const ROOM_GAME_STORAGE_KEY = 'chuanho.room-game.v1';
/** Far above any reachable score; anything larger is not a real record. */
const MAX_SCORE = 100_000;

export interface RoomGameRecord {
  readonly bestScore: number;
  readonly bestStars: number;
  readonly rounds: number;
}

export const EMPTY_RECORD: RoomGameRecord = { bestScore: 0, bestStars: 0, rounds: 0 };

const isCount = (value: unknown, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

/** A stored record if it is well formed, otherwise null. */
export function parseRoomGameRecord(raw: unknown): RoomGameRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { bestScore, bestStars, rounds } = raw as Record<string, unknown>;
  if (!isCount(bestScore, MAX_SCORE) || !isCount(bestStars, 3) || !isCount(rounds, Number.MAX_SAFE_INTEGER)) return null;
  return { bestScore, bestStars, rounds };
}

/** The record after one more round, and whether that round set a new best score. */
export function withRound(record: RoomGameRecord, score: number, stars: number): { record: RoomGameRecord; newBest: boolean } {
  const safeScore = Math.max(0, Math.min(MAX_SCORE, Math.round(score)));
  const newBest = safeScore > record.bestScore;
  return {
    record: {
      bestScore: Math.max(record.bestScore, safeScore),
      bestStars: Math.max(record.bestStars, Math.max(0, Math.min(3, Math.round(stars)))),
      rounds: record.rounds + 1,
    },
    newBest,
  };
}

export function readRoomGameRecord(): RoomGameRecord {
  return readStored(ROOM_GAME_STORAGE_KEY, parseRoomGameRecord) ?? EMPTY_RECORD;
}

/** Adds a finished round to the stored record (the save may fail quietly; the round still counts on screen). */
export function saveRoomGameRound(score: number, stars: number): { record: RoomGameRecord; newBest: boolean } {
  const result = withRound(readRoomGameRecord(), score, stars);
  writeStored(ROOM_GAME_STORAGE_KEY, result.record);
  return result;
}
