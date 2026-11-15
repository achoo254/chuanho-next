/**
 * The music under the game, played from sounds an offline AI model made (see public/audio/CREDITS.md): a loopable
 * ambient pad, and, for the rhythm mode, a soft pulse placed on the beat grid. The pad is not tied to any tempo; the
 * pulse is scheduled from the same BPM and start time as the note chart, so every note lands on a beat the player
 * can hear. Missing files degrade to silence (the game stays playable).
 */
import { audioEngine } from './audio-engine';

const BEATS_PER_BAR = 4;
const LOOKAHEAD_S = 1.2;
const TICK_MS = 150;

export interface BackingTrackOptions {
  readonly bpm: number;
  /** Context time of the first downbeat. */
  readonly startAt: number;
  /** Beat pulse (the rhythm mode needs it; the chanting backdrop does not). */
  readonly pulse: boolean;
  /** Context time to stop; omit to loop until `stop()`. */
  readonly endAt?: number;
}

export interface BackingTrack {
  /** Fades out and releases every node. Safe to call twice. */
  stop(): void;
}

const SILENT: BackingTrack = { stop: () => undefined };

/** Starts the pad (and pulse) on the shared music bus; a no-op handle before audio is unlocked. */
export function startBackingTrack(options: BackingTrackOptions): BackingTrack {
  const engine = audioEngine();
  if (!engine) return SILENT;
  const { ctx, music, buffers } = engine;
  const beat = 60 / options.bpm;

  const out = ctx.createGain();
  out.gain.value = 1;
  out.connect(music);
  const sources = new Set<AudioScheduledSourceNode>();
  const track = (node: AudioScheduledSourceNode): void => {
    sources.add(node);
    node.addEventListener('ended', () => sources.delete(node));
  };

  const padBuffer = buffers.get('pad');
  if (padBuffer) {
    const pad = ctx.createBufferSource();
    pad.buffer = padBuffer;
    pad.loop = true;
    const fadeIn = ctx.createGain();
    fadeIn.gain.setValueAtTime(0, options.startAt);
    fadeIn.gain.linearRampToValueAtTime(0.9, options.startAt + 1.5);
    pad.connect(fadeIn).connect(out);
    pad.start(options.startAt);
    track(pad);
  }

  /** A soft kick on beats 1 and 3, a quieter, higher tick on 2 and 4 (the same recording, played faster). */
  function pulse(at: number, strong: boolean): void {
    const buffer = buffers.get('pulse');
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = strong ? 1 : 1.8;
    const level = ctx.createGain();
    level.gain.value = strong ? 0.7 : 0.22;
    source.connect(level).connect(out);
    source.start(at);
    track(source);
  }

  let nextBeat = 0;
  const timer = window.setInterval(schedule, TICK_MS);
  function schedule(): void {
    if (!options.pulse) {
      window.clearInterval(timer);
      return;
    }
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    for (;;) {
      const at = options.startAt + nextBeat * beat;
      if (at > horizon) break;
      if (options.endAt !== undefined && at >= options.endAt - 0.01) {
        window.clearInterval(timer);
        break;
      }
      pulse(at, nextBeat % (BEATS_PER_BAR / 2) === 0);
      nextBeat += 1;
    }
  }
  schedule();

  let stopped = false;
  return {
    stop(): void {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.4);
      for (const node of sources) {
        try {
          node.stop(now + 0.45);
        } catch {
          // A node that has not started yet throws on some engines; it is disconnected below anyway.
        }
      }
      window.setTimeout(() => {
        out.disconnect();
        sources.clear();
      }, 600);
    },
  };
}
