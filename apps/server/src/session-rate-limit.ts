import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireUser, signedInUserId } from './auth/require-user';
import type { ServerConfig } from './config';
import type { Db } from './db/client';
import { HttpError } from './http-error';

/**
 * How many accounts' worth of traffic one IP may send before the account limit applies: mobile carriers put many
 * players behind one address, so the IP step is only a ceiling on what a single address can cost the server.
 */
export const IP_SHARE = 10;

const tooMany: RequestHandler = (_req, _res, next) => next(new HttpError(429, 'rate-limited'));

/**
 * The guard of a signed-in route, in three steps: a limit per client IP, then `requireUser`, then the real limit per
 * account (`session:<user id>`, shared by all of the account's browsers). The IP step runs before the session is looked
 * up and the account step only after it was found, so a forged cookie never gets a bucket of its own and cannot buy
 * more database lookups than its address is allowed. Over either limit the answer is a JSON 429 `rate-limited`.
 * Spread it into the route: `router.post(path, ...signedInLimit(deps, windowMs, limit), handler)`.
 */
export function signedInLimit(
  { config, db, now }: { readonly config: ServerConfig; readonly db: Db; readonly now: () => Date },
  windowMs: number,
  limit: number,
): RequestHandler[] {
  const perIp = rateLimit({ windowMs, limit: limit * IP_SHARE, standardHeaders: 'draft-8', legacyHeaders: false, handler: tooMany });
  const perAccount = rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (_req, res) => `session:${signedInUserId(res)}`,
    handler: tooMany,
  });
  return [perIp, requireUser(config, db, now), perAccount];
}
