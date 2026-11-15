import { describe, expect, it } from 'vitest';
import { joinCatalog, parseBeatmap, parseBeatmapIndex } from './beatmap-library';

const LEVELS = { easy: [1000, 3000], normal: [1000, 2000, 3000], hard: [1000, 1500, 2000, 2500, 3000] };

describe('parseBeatmapIndex', () => {
  it('rejects anything that is not a version-1 index', () => {
    expect(parseBeatmapIndex(null)).toBeNull();
    expect(parseBeatmapIndex('<!doctype html>')).toBeNull();
    expect(parseBeatmapIndex({ version: 2, tracks: [] })).toBeNull();
    expect(parseBeatmapIndex({ version: 1, tracks: 'x' })).toBeNull();
  });

  it('keeps valid entries once and drops malformed ones', () => {
    const index = parseBeatmapIndex({
      version: 1,
      tracks: [
        { trackId: 'm001', bpm: 60.5, durationMs: 120_000, playable: true },
        { trackId: 'm001', bpm: 70, durationMs: 90_000, playable: true },
        { trackId: 'm002', bpm: 0, durationMs: 90_000, playable: false },
        { trackId: 'm003', bpm: 0, durationMs: 90_000, playable: true },
        { trackId: '../x', bpm: 60, durationMs: 90_000, playable: true },
        { trackId: 'm004', bpm: 60, durationMs: -1, playable: true },
        { trackId: 'm005', bpm: 60, durationMs: 90_000, playable: 'yes' },
      ],
    });
    expect(index).toEqual([
      { trackId: 'm001', bpm: 60.5, durationMs: 120_000, playable: true },
      { trackId: 'm002', bpm: 0, durationMs: 90_000, playable: false },
    ]);
  });
});

describe('parseBeatmap', () => {
  const valid = { version: 1, trackId: 'm001', bpm: 60, offsetMs: 1000, confidence: 0.9, playable: true, levels: LEVELS };

  it('accepts a playable beatmap of the asked track', () => {
    expect(parseBeatmap(valid, 'm001')).toEqual({ trackId: 'm001', bpm: 60, offsetMs: 1000, levels: LEVELS });
  });

  it('refuses another track, an unplayable one or a wrong version', () => {
    expect(parseBeatmap(valid, 'm002')).toBeNull();
    expect(parseBeatmap({ ...valid, playable: false }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, version: 2 }, 'm001')).toBeNull();
    expect(parseBeatmap('<html>', 'm001')).toBeNull();
  });

  it('refuses bad tempo, offset or levels', () => {
    expect(parseBeatmap({ ...valid, bpm: 1000 }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, offsetMs: -5 }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, levels: { ...LEVELS, hard: undefined } }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, levels: { ...LEVELS, easy: [] } }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, levels: { ...LEVELS, normal: [1000, 1000, 2000] } }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, levels: { ...LEVELS, normal: [1000, '2000'] } }, 'm001')).toBeNull();
    expect(parseBeatmap({ ...valid, levels: { ...LEVELS, normal: [1000, Number.NaN] } }, 'm001')).toBeNull();
  });
});

describe('joinCatalog', () => {
  it('offers only playable tracks the manifest lists, in manifest order', () => {
    const tracks = [
      { id: 'm002', file: 'm002-b.mp3', duration: 100, tags: [] },
      { id: 'm001', file: 'm001-a.mp3', duration: 120, tags: [] },
      { id: 'm003', file: 'm003-c.mp3', duration: 90, tags: [] },
    ];
    const index = [
      { trackId: 'm001', bpm: 60, durationMs: 120_000, playable: true },
      { trackId: 'm002', bpm: 62, durationMs: 100_000, playable: true },
      { trackId: 'm003', bpm: 0, durationMs: 90_000, playable: false },
      { trackId: 'm009', bpm: 60, durationMs: 90_000, playable: true },
    ];
    expect(joinCatalog(tracks, index).map((entry) => [entry.track.id, entry.durationMs])).toEqual([
      ['m002', 100_000],
      ['m001', 120_000],
    ]);
  });
});
