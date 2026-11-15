/**
 * The chanting voice-over on disk: public/voice/sutra/manifest.json lists one AI-read clip per line on screen
 * (made offline by tools/chuanho-voice in the workspace repo). Parsed strictly: a manifest that does not match the
 * sutra text on screen is refused, so the voice can never read a line other than the one lit.
 */

export const SUTRA_VOICE_BASE = '/voice/sutra/';

/** One clip, ready for the timeline. */
export interface SutraVoiceClip {
  readonly file: string;
  /** Clip length with its echo tail, and the spoken part at its start (seconds). */
  readonly seconds: number;
  readonly speech: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 60 ? value : null;
}

/** Lower-case syllables without punctuation, to compare the clip's text with the words on screen. */
function syllables(text: string): string {
  return text
    .toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .join(' ');
}

/**
 * The clip for every line on screen, in order, or null when the manifest is malformed, a file name leaves the voice
 * folder, or any clip's text differs from its line.
 */
export function parseSutraVoiceManifest(raw: unknown, lines: readonly (readonly string[])[]): SutraVoiceClip[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.clips) || !Array.isArray(raw.lines) || raw.lines.length !== lines.length) return null;
  const byKey = new Map<string, { file: string; text: string; seconds: number; speech: number }>();
  for (const clip of raw.clips) {
    if (!isRecord(clip)) return null;
    const { key, file, text } = clip;
    const seconds = positive(clip.seconds);
    const speech = positive(clip.speech);
    if (typeof key !== 'string' || typeof file !== 'string' || typeof text !== 'string' || seconds === null || speech === null) return null;
    if (!/^[a-z0-9-]+\.(mp3|ogg|m4a)$/.test(file)) return null;
    byKey.set(key, { file, text, seconds, speech: Math.min(speech, seconds) });
  }
  const result: SutraVoiceClip[] = [];
  for (const [index, key] of raw.lines.entries()) {
    const clip = typeof key === 'string' ? byKey.get(key) : undefined;
    const words = lines[index];
    if (!clip || !words || syllables(clip.text) !== syllables(words.join(' '))) return null;
    result.push({ file: clip.file, seconds: clip.seconds, speech: clip.speech });
  }
  return result;
}
