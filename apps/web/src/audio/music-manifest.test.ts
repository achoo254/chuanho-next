import { describe, expect, it, vi } from 'vitest';
import { LIBRARY_MANIFEST_URL, loadMusicManifest, parseMusicManifest } from './music-manifest';

describe('parseMusicManifest', () => {
  it('rejects anything that is not a manifest', () => {
    expect(parseMusicManifest(null)).toBeNull();
    expect(parseMusicManifest('<!doctype html>')).toBeNull();
    expect(parseMusicManifest({ tracks: 'x' })).toBeNull();
  });

  it('keeps valid tracks and drops unsafe or malformed ones', () => {
    const tracks = parseMusicManifest({
      tracks: [
        { id: 'm001', file: 'm001-ab12cd34.mp3', duration: 150.2, tags: ['rain', 'serene', 3] },
        { id: 'm001', file: 'm001-other.mp3', duration: 120 },
        { id: 'm002', file: '../etc/passwd.mp3', duration: 120 },
        { id: 'm003', file: 'https://evil.example/x.mp3', duration: 120 },
        { id: 'm004', file: 'm004.mp3', duration: 2 },
        { id: 'bad id', file: 'm005.mp3', duration: 120 },
        { id: 'm006', file: 'm006.mp3', duration: 140 },
      ],
    });
    expect(tracks).toEqual([
      { id: 'm001', file: 'm001-ab12cd34.mp3', duration: 150.2, tags: ['rain', 'serene'] },
      { id: 'm006', file: 'm006.mp3', duration: 140, tags: [] },
    ]);
  });
});

describe('loadMusicManifest', () => {
  const BASE = '/media/music/';
  const STATIC_URL = `${BASE}manifest.json`;
  const apiTrack = { id: 'm001', file: 'm001-ab12.mp3', duration: 150, tags: ['moon'] };
  const staticTrack = { id: 'm002', file: 'm002-cd34.mp3', duration: 140, tags: [] };
  const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  /** A fetch answering per URL; an unlisted URL rejects like a network failure. */
  function fakeFetch(answers: Record<string, () => Response>): { fetch: (url: string, init: RequestInit) => Promise<Response>; calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      fetch: (url) => {
        calls.push(url);
        const answer = answers[url];
        return answer ? Promise.resolve(answer()) : Promise.reject(new TypeError('Failed to fetch'));
      },
    };
  }

  it('prefers the library API', async () => {
    const fake = fakeFetch({ [LIBRARY_MANIFEST_URL]: () => jsonResponse({ tracks: [apiTrack] }), [STATIC_URL]: () => jsonResponse({ tracks: [staticTrack] }) });
    expect(await loadMusicManifest(BASE, undefined, fake.fetch)).toEqual([apiTrack]);
    expect(fake.calls).toEqual([LIBRARY_MANIFEST_URL]);
  });

  it.each([
    ['unreachable', undefined],
    ['an error status', () => jsonResponse({ error: 'internal' }, 500)],
    ['the SPA fallback page', () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })],
    ['an empty library', () => jsonResponse({ tracks: [] })],
    ['only unsafe tracks', () => jsonResponse({ tracks: [{ ...apiTrack, file: '../x.mp3' }] })],
  ])('falls back to the static manifest when the API is %s', async (_label, api) => {
    const fake = fakeFetch({ ...(api ? { [LIBRARY_MANIFEST_URL]: api } : {}), [STATIC_URL]: () => jsonResponse({ tracks: [staticTrack] }) });
    expect(await loadMusicManifest(BASE, undefined, fake.fetch)).toEqual([staticTrack]);
    expect(fake.calls).toEqual([LIBRARY_MANIFEST_URL, STATIC_URL]);
  });

  it('answers null when neither has tracks, so the bundled loop plays', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const fake = fakeFetch({ [STATIC_URL]: () => new Response('<!doctype html>', { status: 200 }) });
      expect(await loadMusicManifest(BASE, undefined, fake.fetch)).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });
});
