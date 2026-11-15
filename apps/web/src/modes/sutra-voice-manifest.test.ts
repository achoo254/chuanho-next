import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUTRA_LINES } from '../game/sutra-text';
import { parseSutraVoiceManifest } from './sutra-voice-manifest';

const LINES = [['Xá', 'Lợi', 'Tử,'], ['Nam', 'mô', 'A', 'Di', 'Đà', 'Phật']];
const clip = (key: string, text: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  key,
  file: `${key}.mp3`,
  text,
  seconds: 2,
  speech: 1.6,
  ...extra,
});
const valid = (): Record<string, unknown> => ({
  clips: [clip('line-05', 'Xá Lợi Tử.'), clip('nam-mo-1', 'Nam mô A Di Đà Phật.')],
  lines: ['line-05', 'nam-mo-1'],
});

describe('parseSutraVoiceManifest', () => {
  it('maps every line to its clip, ignoring case and punctuation in the text', () => {
    expect(parseSutraVoiceManifest(valid(), LINES)).toEqual([
      { file: 'line-05.mp3', seconds: 2, speech: 1.6 },
      { file: 'nam-mo-1.mp3', seconds: 2, speech: 1.6 },
    ]);
  });

  it('refuses a clip whose words differ from the line, even by one tone mark', () => {
    const wrong = { ...valid(), clips: [clip('line-05', 'Xá Lợi Tư.'), clip('nam-mo-1', 'Nam mô A Di Đà Phật.')] };
    expect(parseSutraVoiceManifest(wrong, LINES)).toBeNull();
  });

  it('refuses malformed manifests and unsafe file names', () => {
    expect(parseSutraVoiceManifest(null, LINES)).toBeNull();
    expect(parseSutraVoiceManifest({ clips: [], lines: [] }, LINES)).toBeNull();
    expect(parseSutraVoiceManifest({ ...valid(), lines: ['line-05', 'missing'] }, LINES)).toBeNull();
    const escape = { ...valid(), clips: [clip('line-05', 'Xá Lợi Tử.', { file: '../x.mp3' }), clip('nam-mo-1', 'Nam mô A Di Đà Phật.')] };
    expect(parseSutraVoiceManifest(escape, LINES)).toBeNull();
    const badLength = { ...valid(), clips: [clip('line-05', 'Xá Lợi Tử.', { seconds: -1 }), clip('nam-mo-1', 'Nam mô A Di Đà Phật.')] };
    expect(parseSutraVoiceManifest(badLength, LINES)).toBeNull();
  });

  it('keeps the spoken part inside the clip', () => {
    const long = { ...valid(), clips: [clip('line-05', 'Xá Lợi Tử.', { speech: 5 }), clip('nam-mo-1', 'Nam mô A Di Đà Phật.')] };
    expect(parseSutraVoiceManifest(long, LINES)?.[0]?.speech).toBe(2);
  });

  it('accepts the shipped manifest for the sutra text on screen', () => {
    const shipped: unknown = JSON.parse(readFileSync(new URL('../../public/voice/sutra/manifest.json', import.meta.url), 'utf8'));
    const clips = parseSutraVoiceManifest(shipped, SUTRA_LINES.map((line) => line.words));
    expect(clips).toHaveLength(SUTRA_LINES.length);
  });
});
