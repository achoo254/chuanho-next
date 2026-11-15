/** The signed-in account: GET /api/me (who, or 401) and DELETE /api/me/data (everything stored, the account stays). */
import type { MeResponse } from '@chuanho/contract';
import express, { type Router } from 'express';
import { requireUserId } from '../auth/require-user';
import { findDisplayName } from '../auth/session-store';
import { HttpError } from '../http-error';
import type { RouteDeps } from '../route-module';
import { deleteAccountData } from './account-data-store';

export function accountRoutes({ config, db, now }: RouteDeps): Router {
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

  router.delete('/api/me/data', async (req, res) => {
    const userId = await requireUserId(req, config, db, now());
    await deleteAccountData(db, userId);
    res.set('Cache-Control', 'no-store').status(204).end();
  });

  return router;
}
