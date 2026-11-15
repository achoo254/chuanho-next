import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { sql } from 'drizzle-orm';
import { accountRoutes } from './account/account-routes';
import { accountDeletedRoute } from './auth/account-deleted';
import { authRoutes } from './auth/auth-routes';
import { idpMetadata } from './auth/idp-metadata';
import { requireSameOrigin } from './auth/origin-check';
import type { ServerConfig } from './config';
import type { Db } from './db/client';
import { HttpError } from './http-error';
import { libraryRoutes } from './library/library-routes';
import { safeErrorText } from './log-error';
import { quietHourRoutes } from './quiet-hour/quiet-hour-routes';
import { roomRoutes } from './rooms/room-routes';
import type { RouteDeps, RouteModule } from './route-module';
import { syncRoutes } from './sync/sync-routes';

/**
 * Every feature's routes, mounted in this order behind the same-origin check. A new feature is one more entry here.
 * Each module reads its own JSON body (with its own size limit), so nothing parses a body before a route wants it.
 */
const ROUTE_MODULES: readonly RouteModule[] = [authRoutes, accountRoutes, syncRoutes, quietHourRoutes, roomRoutes, libraryRoutes];

export interface AppDeps {
  config: ServerConfig;
  db: Db;
  now?: () => Date;
}

/**
 * The API: health check, sign-in, the account and its data, two-way sync, the quiet hour, and the IdP's notice of a
 * deleted account. The web app itself is static (nginx in production).
 */
export function createApp({ config, db, now = () => new Date() }: AppDeps): Express {
  const app = express();
  // One reader of the IdP's discovery and keys, shared by sign-in and the account-deletion notice.
  const deps: RouteDeps = { config, db, idp: config.auth ? idpMetadata(config.auth.issuer) : null, now };
  app.disable('x-powered-by');
  // nginx on the same host sets X-Forwarded-For; trust it from loopback only (rate limits use the client IP).
  app.set('trust proxy', 'loopback');
  app.use(helmet());

  app.get('/healthz', async (_req, res) => {
    await db.execute(sql`select 1`);
    res.set('Cache-Control', 'no-store').type('text/plain').send('ok');
  });

  // The IdP posts server to server, without an Origin: ahead of the same-origin check, with checks of its own.
  app.use(accountDeletedRoute(deps));
  app.use(requireSameOrigin(config.publicOrigin));
  for (const routes of ROUTE_MODULES) app.use(routes(deps));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not-found')));

  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    // Malformed JSON and oversized bodies from express.json().
    if (typeof err === 'object' && err !== null && 'type' in err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      res.status(400).json({ error: 'invalid-body' });
      return;
    }
    // Never the raw error: a failed query's message carries journal notes and account data.
    console.error('request failed', safeErrorText(err));
    res.status(500).json({ error: 'internal' });
  };
  app.use(onError);
  return app;
}
