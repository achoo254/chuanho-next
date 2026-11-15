import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const SECRET = 's'.repeat(40);

describe('server config', () => {
  it('runs in dev with defaults: PGlite, sign-in off', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({ nodeEnv: 'development', port: 5330, publicOrigin: 'http://localhost:5331', databaseUrl: undefined, auth: null });
  });

  it('treats an empty secret as unset', () => {
    expect(loadConfig({ AUTH_CLIENT_SECRET: '' }).auth).toBeNull();
  });

  it('derives the callback from PUBLIC_URL', () => {
    const config = loadConfig({ PUBLIC_URL: 'https://chuanho.hoandat.com', AUTH_CLIENT_SECRET: SECRET });
    expect(config.auth).toEqual({
      issuer: 'https://auth.hoandat.com',
      clientId: 'chuanho-web',
      clientSecret: SECRET,
      redirectUri: 'https://chuanho.hoandat.com/auth/callback',
    });
  });

  it('requires Postgres, sign-in and https in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL, AUTH_CLIENT_SECRET/);
    const prod = { NODE_ENV: 'production', DATABASE_URL: 'postgres://chuanho@127.0.0.1/chuanho', AUTH_CLIENT_SECRET: SECRET };
    expect(() => loadConfig({ ...prod, PUBLIC_URL: 'http://chuanho.hoandat.com' })).toThrow(/https/);
    expect(() => loadConfig({ ...prod, PUBLIC_URL: 'https://chuanho.hoandat.com', PGLITE_DIR: 'memory' })).toThrow(/PGLITE_DIR/);
    expect(loadConfig({ ...prod, PUBLIC_URL: 'https://chuanho.hoandat.com' }).auth?.redirectUri).toBe('https://chuanho.hoandat.com/auth/callback');
  });

  it('accepts a plain-http issuer only on loopback outside production', () => {
    expect(loadConfig({ AUTH_ISSUER: 'http://127.0.0.1:5335', AUTH_CLIENT_SECRET: SECRET }).auth?.issuer).toBe('http://127.0.0.1:5335');
    expect(() => loadConfig({ AUTH_ISSUER: 'http://auth.example', AUTH_CLIENT_SECRET: SECRET })).toThrow(/AUTH_ISSUER/);
  });

  it('rejects a short secret and disabled TLS checks', () => {
    expect(() => loadConfig({ AUTH_CLIENT_SECRET: 'short' })).toThrow(/AUTH_CLIENT_SECRET/);
    expect(() => loadConfig({ AUTH_CLIENT_SECRET: SECRET, NODE_TLS_REJECT_UNAUTHORIZED: '0' })).toThrow(/TLS/);
  });

  it('keeps the library admin routes off without a token and refuses a short one', () => {
    expect(loadConfig({}).library.adminToken).toBeNull();
    expect(loadConfig({ LIBRARY_ADMIN_TOKEN: '' }).library.adminToken).toBeNull();
    expect(loadConfig({ LIBRARY_ADMIN_TOKEN: SECRET }).library.adminToken).toBe(SECRET);
    expect(() => loadConfig({ LIBRARY_ADMIN_TOKEN: 'short' })).toThrow(/LIBRARY_ADMIN_TOKEN/);
  });

  it('takes the listen salt from env, else derives a stable one from the client secret', () => {
    const salt = 'l'.repeat(40);
    expect(loadConfig({ LIBRARY_LISTEN_SALT: salt }).library.listenSalt).toBe(salt);
    const derived = loadConfig({ AUTH_CLIENT_SECRET: SECRET }).library.listenSalt;
    expect(derived).toBe(loadConfig({ AUTH_CLIENT_SECRET: SECRET }).library.listenSalt);
    expect(derived).not.toContain(SECRET);
    expect(loadConfig({}).library.listenSalt).toMatch(/^[0-9a-f]{64}$/);
    expect(() => loadConfig({ LIBRARY_LISTEN_SALT: 'short' })).toThrow(/LIBRARY_LISTEN_SALT/);
  });

  it('never puts the client secret in an error', () => {
    const secret = 'short-secret';
    try {
      loadConfig({ AUTH_CLIENT_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
