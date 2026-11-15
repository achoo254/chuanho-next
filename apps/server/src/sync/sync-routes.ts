/** POST /api/sync: the device's changes in, the server's changes since its cursor out (contract `SyncRequest`). */
import { parseSyncRequest } from '@chuanho/contract';
import express, { type Router } from 'express';
import { requireUser, signedInUserId } from '../auth/require-user';
import { HttpError } from '../http-error';
import type { RouteDeps } from '../route-module';
import { sessionRateLimit } from '../session-rate-limit';
import { syncAccount } from './sync-store';

/** A full journal (JOURNAL_MAX_ENTRIES entries with 200-character notes in UTF-8) fits with room to spare. */
const SYNC_BODY_LIMIT = '2mb';

export function syncRoutes({ config, db, now }: RouteDeps): Router {
  const router = express.Router();
  const limit = sessionRateLimit(config, 15 * 60 * 1000, config.syncLimitPer15Min);

  // Signed-in check before the body is read: a stranger cannot make the server parse two megabytes.
  router.post('/api/sync', limit, requireUser(config, db, now), express.json({ limit: SYNC_BODY_LIMIT }), async (req, res) => {
    const request = parseSyncRequest(req.body);
    if (!request) throw new HttpError(400, 'invalid-body');
    res.set('Cache-Control', 'no-store').json(await syncAccount(db, signedInUserId(res), request, now()));
  });

  return router;
}
