import type { Request, RequestHandler, Response } from 'express';
import type { ServerConfig } from '../config';
import type { Db } from '../db/client';
import { HttpError } from '../http-error';
import { readSessionToken } from './session-cookie';
import { findSession } from './session-store';

/** The signed-in account's id, or a 401 `sign-in-required` for a request without a live session. */
export async function requireUserId(req: Request, config: ServerConfig, db: Db, now: Date): Promise<string> {
  const token = readSessionToken(req, config);
  const session = token ? await findSession(db, token, now) : null;
  if (!session) throw new HttpError(401, 'sign-in-required');
  return session.userId;
}

/**
 * The same check as middleware, for routes that should refuse a signed-out request before reading its body; the
 * handler then takes the id with `signedInUserId(res)`.
 */
export function requireUser(config: ServerConfig, db: Db, now: () => Date): RequestHandler {
  return async (req, res, next) => {
    res.locals.userId = await requireUserId(req, config, db, now());
    next();
  };
}

/** The id `requireUser` found; a route that forgot the middleware fails loudly instead of acting for nobody. */
export function signedInUserId(res: Response): string {
  const userId: unknown = res.locals.userId;
  if (typeof userId !== 'string') throw new Error('requireUser middleware missing');
  return userId;
}
