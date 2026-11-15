/** Everything web and server agree on. Import from `@chuanho/contract`; the web side takes types and pure helpers only. */
export * from './journal';
export * from './library';
export * from './primitives';
export * from './progress';
export * from './quiet-hour';
export * from './rooms';
export * from './sync';
export * from './wish-filter';

/** The account as the web needs it (from `GET /api/me`, 200 when signed in, 401 otherwise). */
export interface MeResponse {
  readonly id: string;
  /** A short display name, never an email address. */
  readonly name: string;
}
