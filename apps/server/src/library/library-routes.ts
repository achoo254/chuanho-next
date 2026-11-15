/**
 * The shared music library ("kho nhạc"). Public: the manifest the player reads, the track list with metadata, and an
 * anonymous listen count. Operator only (Bearer `LIBRARY_ADMIN_TOKEN`; 404 while it is unset): ingest a manifest,
 * take a track down or put it back, list the removed files to delete. Files on disk are never touched here: the
 * server user cannot write the library directory, the operator's tooling deletes what `GET /api/library/removed` lists.
 * Like every route module, POSTs pass the app's same-origin check first, so the operator sends the app's Origin too.
 */
import { parseLibraryIngestInput, parseLibraryListenInput, parseLibraryRemoveInput, isLibraryTrackId, vietnamDay } from '@chuanho/contract';
import express, { type RequestHandler, type Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from '../http-error';
import type { RouteDeps } from '../route-module';
import { libraryAdminEnabled, listenerHash, requireLibraryAdmin } from './library-access';
import {
  ingestLibraryTracks,
  pruneLibraryListensBefore,
  readLibraryManifest,
  readLibraryTracks,
  readRemovedTracks,
  recordLibraryListen,
  removeLibraryTrack,
  restoreLibraryTrack,
} from './library-store';

/** Operator calls per 15 minutes per IP: a handful per factory run, the rest slows down token guessing. */
const ADMIN_LIMIT_PER_15MIN = 60;
const MINUTE = 60_000;

const tooMany: RequestHandler = (_req, _res, next) => next(new HttpError(429, 'rate-limited'));

function trackIdParam(raw: unknown): string {
  if (!isLibraryTrackId(raw)) throw new HttpError(404, 'unknown-track');
  return raw;
}

export function libraryRoutes({ config, db, now }: RouteDeps): Router {
  const { adminToken, listenSalt, listenLimitPerIp15Min, listenLimitGlobalPerMin } = config.library;
  const router = express.Router();
  const listenPerIp = rateLimit({ windowMs: 15 * MINUTE, limit: listenLimitPerIp15Min, standardHeaders: 'draft-8', legacyHeaders: false, handler: tooMany });
  const listenGlobal = rateLimit({
    windowMs: MINUTE,
    limit: listenLimitGlobalPerMin,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: () => 'library-listen:all',
    handler: tooMany,
  });
  const admin = [
    libraryAdminEnabled(adminToken),
    rateLimit({ windowMs: 15 * MINUTE, limit: ADMIN_LIMIT_PER_15MIN, standardHeaders: false, legacyHeaders: false, handler: tooMany }),
    requireLibraryAdmin(adminToken),
  ];
  /** Listener hashes only deduplicate today's listens: older days are dropped on the first listen of a new day. */
  let prunedBefore: string | null = null;

  router.get('/api/library/manifest', async (_req, res) => {
    res.set('Cache-Control', 'no-cache').json({ tracks: await readLibraryManifest(db) });
  });

  router.get('/api/library/tracks', async (_req, res) => {
    res.set('Cache-Control', 'no-cache').json({ tracks: await readLibraryTracks(db) });
  });

  router.post('/api/library/listen', listenPerIp, listenGlobal, express.json({ limit: '1kb' }), async (req, res) => {
    const input = parseLibraryListenInput(req.body);
    if (!input) throw new HttpError(400, 'invalid-body');
    const day = vietnamDay(now().getTime());
    if (prunedBefore !== day) {
      prunedBefore = day;
      await pruneLibraryListensBefore(db, day);
    }
    const hash = listenerHash(listenSalt, day, req.ip ?? '', req.get('user-agent') ?? '');
    const result = await recordLibraryListen(db, input.trackId, day, hash);
    if (result === 'unknown') throw new HttpError(404, 'unknown-track');
    res.set('Cache-Control', 'no-store').json({ counted: result === 'counted' });
  });

  router.post('/api/library/ingest', ...admin, express.json({ limit: '256kb' }), async (req, res) => {
    const input = parseLibraryIngestInput(req.body);
    if (!input) throw new HttpError(400, 'invalid-body');
    res.set('Cache-Control', 'no-store').json(await ingestLibraryTracks(db, input.tracks, now()));
  });

  router.post('/api/library/tracks/:id/remove', ...admin, express.json({ limit: '2kb' }), async (req, res) => {
    const id = trackIdParam(req.params.id);
    const input = parseLibraryRemoveInput(req.body);
    if (!input) throw new HttpError(400, 'invalid-body');
    const removed = await removeLibraryTrack(db, id, input.reason, now());
    if (!removed) throw new HttpError(404, 'unknown-track');
    res.set('Cache-Control', 'no-store').json(removed);
  });

  router.post('/api/library/tracks/:id/restore', ...admin, async (req, res) => {
    const result = await restoreLibraryTrack(db, trackIdParam(req.params.id));
    if (result.kind === 'unknown') throw new HttpError(404, 'unknown-track');
    if (result.kind === 'full') throw new HttpError(409, 'library-full');
    res.set('Cache-Control', 'no-store').json(result.track);
  });

  router.get('/api/library/removed', ...admin, async (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ tracks: await readRemovedTracks(db) });
  });

  return router;
}
