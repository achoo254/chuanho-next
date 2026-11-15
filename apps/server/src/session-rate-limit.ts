import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { readSessionToken } from './auth/session-cookie';
import { hashToken } from './auth/session-store';
import type { ServerConfig } from './config';
import { HttpError } from './http-error';

/**
 * A limit per signed-in browser (its session cookie) rather than per IP: mobile carriers put many players behind one
 * address, and the routes it guards need a session anyway. A request without a session counts against its IP.
 * Over the limit the answer is a JSON 429 `rate-limited`.
 */
export function sessionRateLimit(config: ServerConfig, windowMs: number, limit: number): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const token = readSessionToken(req, config);
      return token ? `session:${hashToken(token)}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
    handler: (_req, _res, next) => next(new HttpError(429, 'rate-limited')),
  });
}
