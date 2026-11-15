import { describe, expect, it } from 'vitest';
import {
  LIBRARY_MAX_TAGS,
  LIBRARY_MAX_TRACKS,
  cleanLibraryTags,
  isLibraryListen,
  parseLibraryIngestInput,
  parseLibraryListenInput,
  parseLibraryRemoveInput,
} from './library';

const track = (n: number, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: `m${String(n).padStart(3, '0')}`,
  file: `m${String(n).padStart(3, '0')}-ab12.mp3`,
  duration: 150,
  tags: ['moon'],
  ...extra,
});

describe('library ingest input', () => {
  it('accepts a manifest-shaped body with optional beat data', () => {
    expect(parseLibraryIngestInput({ tracks: [track(1, { bpm: 68, playableBeatmap: true, tags: ['Moon', 'moon', 'rain', 3, '../x'] })] })).toEqual({
      tracks: [{ id: 'm001', file: 'm001-ab12.mp3', duration: 150, tags: ['moon', 'rain'], bpm: 68, playableBeatmap: true }],
    });
  });

  it('rejects the whole body when one track is bad or repeats', () => {
    expect(parseLibraryIngestInput(null)).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1), track(2, { file: '../etc/passwd.mp3' })] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1), track(2, { file: 'https://evil.example/x.mp3' })] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1, { duration: 2 })] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1, { bpm: -1 })] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1, { playableBeatmap: 'yes' })] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1), track(1)] })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: [track(1), track(2, { file: 'm001-ab12.mp3' })] })).toBeNull();
  });

  it('refuses more tracks than the library holds', () => {
    const tracks = Array.from({ length: LIBRARY_MAX_TRACKS + 1 }, (_, i) => track(i + 1));
    expect(parseLibraryIngestInput({ tracks })).toBeNull();
    expect(parseLibraryIngestInput({ tracks: tracks.slice(0, LIBRARY_MAX_TRACKS) })?.tracks).toHaveLength(LIBRARY_MAX_TRACKS);
  });
});

describe('library tags, listens and removals', () => {
  it('caps tags', () => {
    const many = Array.from({ length: LIBRARY_MAX_TAGS + 5 }, (_, i) => `t${i}`);
    expect(cleanLibraryTags(many)).toHaveLength(LIBRARY_MAX_TAGS);
    expect(cleanLibraryTags('moon')).toEqual([]);
  });

  it('parses a listen by track id only', () => {
    expect(parseLibraryListenInput({ trackId: 'm001' })).toEqual({ trackId: 'm001' });
    expect(parseLibraryListenInput({ trackId: 'bad id' })).toBeNull();
    expect(parseLibraryListenInput({})).toBeNull();
  });

  it('needs a non-blank, short removal reason', () => {
    expect(parseLibraryRemoveInput({ reason: '  harsh hiss at 1:20 ' })).toEqual({ reason: 'harsh hiss at 1:20' });
    expect(parseLibraryRemoveInput({ reason: '   ' })).toBeNull();
    expect(parseLibraryRemoveInput({ reason: 'x'.repeat(201) })).toBeNull();
    expect(parseLibraryRemoveInput(undefined)).toBeNull();
  });

  it('counts a listen after 30 s or half the track, whichever is smaller', () => {
    expect(isLibraryListen(29.9, 180)).toBe(false);
    expect(isLibraryListen(30, 180)).toBe(true);
    expect(isLibraryListen(19.9, 40)).toBe(false);
    expect(isLibraryListen(20, 40)).toBe(true);
    expect(isLibraryListen(Number.NaN, 40)).toBe(false);
    expect(isLibraryListen(10, 0)).toBe(false);
  });
});
