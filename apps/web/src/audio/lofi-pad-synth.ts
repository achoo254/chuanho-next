/**
 * A soft lofi backing track synthesized in WebAudio: a slow four-chord pad and, optionally, a gentle pulse on every
 * beat. Because the music is generated from the same BPM and start time as the note chart, every note lands on a
 * beat the player can hear. Bars are scheduled a little ahead with a timer, so the track can run for a fixed song
 * or loop until stopped.
 */
import { audioEngine } from './audio-engine';

/** Dmaj7, Bm7, Gmaj7, A6 as MIDI notes: warm, unresolved, easy to loop. */
const PROGRESSION: readonly (readonly number[])[] = [
  [50, 54, 57, 61],
  [47, 50, 54, 57],
  [43, 47, 50, 54],
  [45, 49, 52, 54],
];
const BEATS_PER_BAR = 4;
const LOOKAHEAD_S = 1.2;
const TICK_MS = 150;

const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface LofiPadOptions {
  readonly bpm: number;
  /** Context time of the first downbeat. */
  readonly startAt: number;
  /** Beat pulse (the rhythm mode needs it; the chanting backdrop does not). */
  readonly pulse: boolean;
  /** Context time to stop scheduling; omit to loop until `stop()`. */
  readonly endAt?: number;
}

export interface LofiPad {
  /** Fades out and releases every node. Safe to call twice. */
  stop(): void;
}

const SILENT_PAD: LofiPad = { stop: () => undefined };

/** Starts the pad on the shared music bus; a no-op handle before audio is unlocked. */
export function startLofiPad(options: LofiPadOptions): LofiPad {
  const engine = audioEngine();
  if (!engine) return SILENT_PAD;
  const { ctx, music } = engine;
  const beat = 60 / options.bpm;
  const bar = beat * BEATS_PER_BAR;

  const out = ctx.createGain();
  out.gain.value = 1;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1100;
  filter.Q.value = 0.4;
  filter.connect(out).connect(music);

  const sources = new Set<AudioScheduledSourceNode>();
  const track = (node: AudioScheduledSourceNode): void => {
    sources.add(node);
    node.addEventListener('ended', () => sources.delete(node));
  };

  function padChord(notes: readonly number[], at: number): void {
    for (const midi of notes) {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = detune;
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(0.035, at + 0.6);
        env.gain.setValueAtTime(0.035, at + bar - 0.2);
        env.gain.linearRampToValueAtTime(0, at + bar + 0.6);
        osc.connect(env).connect(filter);
        osc.start(at);
        osc.stop(at + bar + 0.7);
        track(osc);
      }
    }
  }

  /** A soft kick on beats 1 and 3, a quiet tick on 2 and 4. */
  function pulse(at: number, strong: boolean): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    if (strong) {
      osc.frequency.setValueAtTime(130, at);
      osc.frequency.exponentialRampToValueAtTime(50, at + 0.14);
      env.gain.setValueAtTime(0.32, at);
      env.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    } else {
      osc.frequency.setValueAtTime(1600, at);
      env.gain.setValueAtTime(0.04, at);
      env.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    }
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + 0.25);
    track(osc);
  }

  let nextBar = 0;
  function schedule(): void {
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    for (;;) {
      const at = options.startAt + nextBar * bar;
      if (at > horizon) break;
      if (options.endAt !== undefined && at >= options.endAt - 0.01) {
        window.clearInterval(timer);
        break;
      }
      padChord(PROGRESSION[nextBar % PROGRESSION.length] ?? [], at);
      if (options.pulse) for (let b = 0; b < BEATS_PER_BAR; b += 1) pulse(at + b * beat, b % 2 === 0);
      nextBar += 1;
    }
  }

  const timer = window.setInterval(schedule, TICK_MS);
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
