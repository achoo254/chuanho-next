/**
 * "Phòng giải nghiệp" over HTTP: `/api/rooms` (see packages/contract/src/rooms.ts for the table). Every route needs a
 * signed-in session; the state lives in a RoomStore in memory, one per app, and changes are pushed to the room's open
 * event streams. Wish text is never logged.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type RoomErrorCode, isRecord, parseRoomCreateInput, parseRoomLockInput } from '@chuanho/contract';
import express, { type ErrorRequestHandler, type Request, type Response, type Router } from 'express';
import { requireUser, signedInUserId } from '../auth/require-user';
import { findDisplayName } from '../auth/session-store';
import { HttpError } from '../http-error';
import type { RouteDeps } from '../route-module';
import { sessionRateLimit } from '../session-rate-limit';
import { RoomEventHub } from './room-event-hub';
import { RoomError } from './room-model';
import { RoomStore } from './room-store';

/** How often burnt-out rooms are turned to ashes and expired ones deleted, between requests. */
export const ROOM_SWEEP_MS = 15_000;

const MINUTE = 60_000;
/** Changes per minute per session: generous for tapping around, tight for scripts. */
const WRITES_PER_MINUTE = 30;
/** Reads per minute per session: the 5 s polling fallback plus reconnects. */
const READS_PER_MINUTE = 40;

const STATUS: Readonly<Record<RoomErrorCode, number>> = {
  'room-not-found': 404,
  'not-member': 403,
  'room-full': 409,
  'room-locked': 409,
  'room-ashes': 409,
  'too-many-rooms': 429,
  'already-lit': 409,
  'wish-rejected': 422,
  'wish-too-fast': 429,
  'wish-limit': 409,
  'wish-not-found': 404,
  'not-allowed': 403,
  'already-reported': 409,
  'own-wish': 409,
};

export const newRoomCode = (): string => Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length))).join('');

/** The code in the path, upper-cased; an impossible one is answered like an unknown room. */
function codeOf(req: Request): string {
  const raw = req.params.code;
  return typeof raw === 'string' ? raw.toUpperCase() : '';
}

function wishIdOf(req: Request): string {
  const raw = req.params.wishId;
  if (typeof raw !== 'string' || raw.length > 64) throw new RoomError('wish-not-found');
  return raw;
}

export function roomRoutes({ config, db, now }: RouteDeps): Router {
  const router = express.Router();
  const hub = new RoomEventHub((code, userId) => store.snapshotOrNull(code, userId));
  const store: RoomStore = new RoomStore({
    now: () => now().getTime(),
    newId: randomUUID,
    newCode: newRoomCode,
    onSweep: ({ turnedToAshes, purged }) => {
      for (const code of turnedToAshes) hub.broadcast(code);
      for (const code of purged) hub.closeRoom(code);
    },
    log: (line) => console.info(line),
  });
  // Burn-outs reach open streams even when nobody calls; never what keeps the process alive.
  setInterval(() => store.sweep(), ROOM_SWEEP_MS).unref();

  const signedIn = requireUser(config, db, now);
  const writes = sessionRateLimit(config, MINUTE, WRITES_PER_MINUTE);
  const reads = sessionRateLimit(config, MINUTE, READS_PER_MINUTE);
  const json = express.json({ limit: '2kb' });

  /** The short name others see: the account's display name, or empty for the web to say "someone". */
  async function memberName(userId: string): Promise<string> {
    const name = await findDisplayName(db, userId);
    if (name === undefined) throw new HttpError(401, 'sign-in-required');
    return name ?? '';
  }

  /** Answers with the caller's snapshot and pushes the change to everyone else in the room. */
  function changed(res: Response, code: string, snapshot: unknown, status = 200): void {
    res.status(status).set('Cache-Control', 'no-store').json(snapshot);
    hub.broadcast(code);
  }

  router.post('/api/rooms', writes, signedIn, json, async (req, res) => {
    const input = parseRoomCreateInput(req.body);
    if (!input) throw new HttpError(400, 'invalid-body');
    const userId = signedInUserId(res);
    const snapshot = store.create(userId, await memberName(userId), input);
    res.status(201).set('Cache-Control', 'no-store').json(snapshot);
  });

  router.get('/api/rooms/:code', reads, signedIn, (req, res) => {
    res.set('Cache-Control', 'no-store').json(store.snapshot(codeOf(req), signedInUserId(res)));
  });

  router.get('/api/rooms/:code/events', reads, signedIn, (req, res) => {
    const code = codeOf(req);
    const userId = signedInUserId(res);
    const first = store.snapshot(code, userId);
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      // nginx would otherwise hold the events back in its buffer.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const forget = hub.open(code, userId, res, first);
    req.on('close', forget);
  });

  router.post('/api/rooms/:code/join', writes, signedIn, async (req, res) => {
    const code = codeOf(req);
    const userId = signedInUserId(res);
    changed(res, code, store.join(code, userId, await memberName(userId)));
  });

  router.post('/api/rooms/:code/leave', writes, signedIn, (req, res) => {
    const code = codeOf(req);
    store.leave(code, signedInUserId(res));
    res.status(204).set('Cache-Control', 'no-store').end();
    hub.broadcast(code);
  });

  router.post('/api/rooms/:code/light', writes, signedIn, (req, res) => {
    const code = codeOf(req);
    changed(res, code, store.light(code, signedInUserId(res)));
  });

  router.post('/api/rooms/:code/wishes', writes, signedIn, json, (req, res) => {
    const body: unknown = req.body;
    if (!isRecord(body) || typeof body.text !== 'string' || body.text.length > 400) throw new HttpError(400, 'invalid-body');
    const code = codeOf(req);
    changed(res, code, store.addWish(code, signedInUserId(res), body.text), 201);
  });

  router.delete('/api/rooms/:code/wishes/:wishId', writes, signedIn, (req, res) => {
    const code = codeOf(req);
    changed(res, code, store.deleteWish(code, signedInUserId(res), wishIdOf(req)));
  });

  router.post('/api/rooms/:code/wishes/:wishId/report', writes, signedIn, (req, res) => {
    const code = codeOf(req);
    changed(res, code, store.report(code, signedInUserId(res), wishIdOf(req)));
  });

  router.post('/api/rooms/:code/lock', writes, signedIn, json, (req, res) => {
    const input = parseRoomLockInput(req.body);
    if (!input) throw new HttpError(400, 'invalid-body');
    const code = codeOf(req);
    changed(res, code, store.setLocked(code, signedInUserId(res), input.locked));
  });

  // Room refusals as `{ error }` (and the filter's reason); anything else goes on to the app's handler.
  const onRoomError: ErrorRequestHandler = (err: unknown, _req, res, next) => {
    if (!(err instanceof RoomError)) return next(err);
    res.status(STATUS[err.code]).json(err.reason ? { error: err.code, reason: err.reason } : { error: err.code });
  };
  router.use('/api/rooms', onRoomError);
  return router;
}
