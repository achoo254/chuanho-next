import { describe, expect, it } from 'vitest';
import { parseMusicManifest } from './music-manifest';

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
