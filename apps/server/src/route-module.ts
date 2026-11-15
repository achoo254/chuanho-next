import type { Router } from 'express';
import type { IdpMetadata } from './auth/idp-metadata';
import type { ServerConfig } from './config';
import type { Db } from './db/client';

/** What every route module gets from the app: config, database, the IdP reader (null with sign-in off) and the clock. */
export interface RouteDeps {
  config: ServerConfig;
  db: Db;
  idp: IdpMetadata | null;
  now: () => Date;
}

/** A feature's routes. app.ts mounts each module of its list behind the same-origin check, in order. */
export type RouteModule = (deps: RouteDeps) => Router;
