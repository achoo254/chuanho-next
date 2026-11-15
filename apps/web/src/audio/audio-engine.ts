/**
 * One WebAudio context for the whole app: created and resumed inside the Start tap (mobile browsers, iOS above all,
 * only play audio after a user gesture), short samples decoded into buffers for instant playback, and the clock the
 * rhythm mode judges taps against.
 *
 * Every failure degrades to silence or a synthesized fallback, never to a broken screen.
 */

export const SAMPLES = {
  mo: '/audio/mo-hit.wav',
  bell: '/audio/bell.mp3',
  bowl: '/audio/bowl.mp3',
} as const;
export type SampleName = keyof typeof SAMPLES;

interface Engine {
  readonly ctx: AudioContext;
  /** Sound effects (wooden bell, bell, bowl). */
  readonly sfx: GainNode;
  /** Synthesized music (the lofi pad), kept below the effects. */
  readonly music: GainNode;
  readonly buffers: Map<SampleName, AudioBuffer>;
}

let engine: Engine | null = null;
let loading: Promise<void> | null = null;

type WindowWithLegacyAudio = Window & { webkitAudioContext?: typeof AudioContext };

function createContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as WindowWithLegacyAudio).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: 'interactive' });
  } catch (error) {
    console.warn('AudioContext could not start', error);
    return null;
  }
}

async function loadSample(ctx: AudioContext, name: SampleName): Promise<[SampleName, AudioBuffer] | null> {
  try {
    const response = await fetch(SAMPLES[name]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return [name, await ctx.decodeAudioData(await response.arrayBuffer())];
  } catch (error) {
    console.warn(`Sample ${name} unavailable, using fallback`, error);
    return null;
  }
}

/**
 * Starts audio. Call it synchronously inside a user gesture (a click on Start); later calls only resume a context
 * the browser suspended (a backgrounded tab). Samples load in the background.
 */
export function unlockAudio(): void {
  if (!engine) {
    const ctx = createContext();
    if (!ctx) return;
    const sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(ctx.destination);
    const music = ctx.createGain();
    music.gain.value = 0.55;
    music.connect(ctx.destination);
    engine = { ctx, sfx, music, buffers: new Map() };
    // A one-sample silent buffer started in the gesture is what finally unmutes iOS Safari.
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silent.connect(ctx.destination);
    silent.start();
  }
  const { ctx, buffers } = engine;
  if (ctx.state === 'suspended') ctx.resume().catch((error: unknown) => console.warn('AudioContext resume failed', error));
  loading ??= Promise.all((Object.keys(SAMPLES) as SampleName[]).map((name) => loadSample(ctx, name))).then((loaded) => {
    for (const entry of loaded) if (entry) buffers.set(entry[0], entry[1]);
  });
}

/** The context and its buses, or null before Start (or where WebAudio is missing). */
export function audioEngine(): Engine | null {
  return engine;
}

/** A dry wooden "tok" synthesized on the spot, for when the wooden bell sample did not load. */
function synthWoodblock(e: Engine, when: number, gain: number): void {
  const osc = e.ctx.createOscillator();
  const env = e.ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(720, when);
  osc.frequency.exponentialRampToValueAtTime(420, when + 0.08);
  env.gain.setValueAtTime(gain * 0.8, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
  osc.connect(env).connect(e.sfx);
  osc.start(when);
  osc.stop(when + 0.14);
}

/** Plays a sample now (or at context time `when`). Missing samples are silent, except the wooden bell which is synthesized. */
export function playSample(name: SampleName, options: { gain?: number; when?: number } = {}): void {
  const e = engine;
  if (!e) return;
  const when = options.when ?? e.ctx.currentTime;
  const gain = options.gain ?? 1;
  const buffer = e.buffers.get(name);
  if (!buffer) {
    if (name === 'mo') synthWoodblock(e, when, gain);
    return;
  }
  const source = e.ctx.createBufferSource();
  source.buffer = buffer;
  const level = e.ctx.createGain();
  level.gain.value = gain;
  source.connect(level).connect(e.sfx);
  source.start(when);
}

/**
 * The context time the listener hears at `performanceMs` (a `performance.now()` / event timestamp). Uses the
 * output timestamp where the browser reports it, so the judgement includes the device's output latency.
 */
export function heardContextTime(performanceMs: number): number | null {
  const e = engine;
  if (!e) return null;
  const stamp = typeof e.ctx.getOutputTimestamp === 'function' ? e.ctx.getOutputTimestamp() : undefined;
  if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
    return stamp.contextTime + (performanceMs - stamp.performanceTime) / 1000;
  }
  const latency = e.ctx.outputLatency || e.ctx.baseLatency || 0;
  return e.ctx.currentTime - latency + (performanceMs - performance.now()) / 1000;
}

/** A short buzz on devices that support it (Android); iOS Safari has no vibration API. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by policy; the visual and audio feedback still play.
  }
}
