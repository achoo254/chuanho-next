/** The signed-in account: GET /api/me (who, or 401) and DELETE /api/me/data (everything stored, the account stays). */
import type { MeResponse } from '@chuanho/contract';
import express, { type Router } from 'express';
import { requireUserId, signedInUserId } from '../auth/require-user';
import { findDisplayName } from '../auth/session-store';
import { HttpError } from '../http-error';
import type { RouteDeps } from '../route-module';
import { signedInLimit } from '../session-rate-limit';
import { deleteAccountData } from './account-data-store';

/** "Delete all my data" per account per 15 minutes: a person needs it once; a loop of it only churns the database. */
export const DATA_DELETES_PER_15_MIN = 5;

export function accountRoutes(deps: RouteDeps): Router {
  const { config, db, now } = deps;
  const router = express.Router();

  router.get('/api/me', async (req, res) => {
    const userId = await requireUserId(req, config, db, now());
    const displayName = await findDisplayName(db, userId);
    // The session's user row is gone only if the account was deleted between the two reads.
    if (displayName === undefined) throw new HttpError(401, 'sign-in-required');
    // No name from the IdP: an empty name, and the web shows its own word for "you".
    const me: MeResponse = { id: userId, name: displayName ?? '' };
    res.set('Cache-Control', 'no-store').json(me);
  });

  router.delete('/api/me/data', ...signedInLimit(deps, 15 * 60 * 1000, DATA_DELETES_PER_15_MIN), async (_req, res) => {
    await deleteAccountData(db, signedInUserId(res), now());
    res.set('Cache-Control', 'no-store').status(204).end();
  });

  return router;
}
