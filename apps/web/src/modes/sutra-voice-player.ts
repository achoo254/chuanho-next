/**
 * Plays the chanting voice-over on the app's shared AudioContext: fetches and decodes the clips the first time the
 * chanting mode needs them (never in the first bundle, never before Start), schedules the lines back to back on the
 * audio clock through a gain of its own, and lowers the music bus while the voice reads. Any loading failure
 * resolves to null, and the mode stays silent and strike-driven as before.
 */
import { audioEngine } from '../audio/audio-engine';
import { SUTRA_LINES } from '../game/sutra-text';
import { SUTRA_VOICE_BASE, type SutraVoiceClip, parseSutraVoiceManifest } from './sutra-voice-manifest';
import { type VoiceTimeline, buildVoiceTimeline } from './sutra-voice-timeline';

type AudioEngine = NonNullable<ReturnType<typeof audioEngine>>;

/** Decoded clips, one per line on screen. */
export interface SutraVoice {
  readonly clips: readonly SutraVoiceClip[];
  readonly buffers: readonly AudioBuffer[];
}

export interface SutraVoicePlayback {
  readonly timeline: VoiceTimeline;
  stop(): void;
}

const VOICE_LEVEL = 1;
/** Music level while the voice reads, as a share of its normal level. */
const DUCKED_SHARE = 0.3;
/** Time constants of the music dip and its return (seconds). */
const DUCK_IN = 0.25;
const DUCK_OUT = 0.6;
const LEAD_IN_SECONDS = 0.25;

const loads = new WeakMap<BaseAudioContext, Promise<SutraVoice | null>>();

async function fetchVoice(ctx: BaseAudioContext): Promise<SutraVoice | null> {
  try {
    const response = await fetch(`${SUTRA_VOICE_BASE}manifest.json`);
    if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
    const clips = parseSutraVoiceManifest(await response.json(), SUTRA_LINES.map((line) => line.words));
    if (!clips) throw new Error('manifest does not match the sutra text');
    const buffers = await Promise.all(
      clips.map(async (clip) => {
        const clipResponse = await fetch(`${SUTRA_VOICE_BASE}${clip.file}`);
        if (!clipResponse.ok) throw new Error(`${clip.file} HTTP ${clipResponse.status}`);
        return ctx.decodeAudioData(await clipResponse.arrayBuffer());
      }),
    );
    return { clips, buffers };
  } catch (error) {
    console.warn('Chanting voice unavailable, staying silent', error);
    loads.delete(ctx); // a later visit may try again (the network may be back)
    return null;
  }
}

/** The decoded voice for this context, loaded once and shared by every visit to the chanting mode. */
export function loadSutraVoice(ctx: BaseAudioContext): Promise<SutraVoice | null> {
  const cached = loads.get(ctx);
  if (cached) return cached;
  const pending = fetchVoice(ctx);
  loads.set(ctx, pending);
  return pending;
}

/** The music bus level before the first dip, so overlapping dips always return to the true level. */
let musicLevel: number | null = null;

function duckMusic(engine: AudioEngine, at: number): void {
  const gain = engine.music.gain;
  musicLevel ??= gain.value;
  gain.cancelScheduledValues(at);
  gain.setTargetAtTime(musicLevel * DUCKED_SHARE, at, DUCK_IN);
}

function restoreMusic(engine: AudioEngine, at: number): void {
  if (musicLevel === null) return;
  engine.music.gain.setTargetAtTime(musicLevel, at, DUCK_OUT);
}

/** Starts reading at line `fromLine`; the returned handle stops the voice and brings the music back. */
export function startSutraVoice(engine: AudioEngine, voice: SutraVoice, fromLine: number): SutraVoicePlayback {
  const { ctx } = engine;
  const startAt = ctx.currentTime + LEAD_IN_SECONDS;
  const timeline = buildVoiceTimeline(
    voice.clips.map((clip, index) => ({ words: SUTRA_LINES[index]?.words.length ?? 0, seconds: clip.seconds, speech: clip.speech })),
    fromLine,
    startAt,
  );
  const output = ctx.createGain();
  output.gain.value = VOICE_LEVEL;
  output.connect(ctx.destination);
  const sources = timeline.entries.flatMap((entry) => {
    const buffer = voice.buffers[entry.line];
    if (!buffer) return [];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    source.start(entry.start);
    return [source];
  });
  duckMusic(engine, ctx.currentTime);
  restoreMusic(engine, timeline.end);

  let stopped = false;
  return {
    timeline,
    stop(): void {
      if (stopped) return;
      stopped = true;
      const now = ctx.currentTime;
      const lastSpeechEnd = timeline.entries.at(-1)?.speechEnd ?? 0;
      if (now >= lastSpeechEnd) {
        // Finished reading: let the last line's echo ring out on its own.
        window.setTimeout(() => output.disconnect(), Math.max(0, timeline.end - now) * 1000 + 200);
      } else {
        output.gain.setTargetAtTime(0, now, 0.05); // a short fade, no click
        for (const source of sources) {
          try {
            source.stop(now + 0.2);
          } catch {
            // Already stopped: nothing to do.
          }
        }
        window.setTimeout(() => output.disconnect(), 400);
      }
      engine.music.gain.cancelScheduledValues(now);
      restoreMusic(engine, now);
      if (now >= timeline.end) musicLevel = null;
    },
  };
}
