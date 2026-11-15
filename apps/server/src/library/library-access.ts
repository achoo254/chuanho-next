/**
 * Who may do what on the music library: the operator's Bearer token for the admin routes, and the anonymous listener
 * hash that deduplicates listens without ever keeping an IP address or a user agent.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from '../http-error';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Admin routes answer the plain API 404 while no token is configured, so they cannot be told apart from no route. */
export function libraryAdminEnabled(token: string | null): RequestHandler {
  return (_req, _res, next) => next(token ? undefined : new HttpError(404, 'not-found'));
}

/**
 * Requires `Authorization: Bearer <token>`. Both sides are hashed first so the constant-time comparison runs on equal
 * lengths and does not reveal the token's length.
 */
export function requireLibraryAdmin(token: string | null): RequestHandler {
  const expected = token ? digest(token) : null;
  return (req, _res, next) => {
    const given = /^Bearer\s+(\S+)$/.exec(req.get('authorization') ?? '')?.[1];
    if (!expected) return next(new HttpError(404, 'not-found'));
    if (!given || !timingSafeEqual(digest(given), expected)) return next(new HttpError(401, 'unauthorized'));
    next();
  };
}

/**
 * The anonymous listener of a day: HMAC(salt, day, IP, user agent). Keyed by a server secret so the small IPv4 space
 * cannot be brute-forced back from a stored hash, and salted with the day so the same person cannot be linked across days.
 */
export function listenerHash(salt: string, day: string, ip: string, userAgent: string): string {
  return createHmac('sha256', salt).update(`${day}\n${ip}\n${userAgent}`).digest('hex');
}
