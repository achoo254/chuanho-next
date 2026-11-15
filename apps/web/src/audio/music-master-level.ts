/**
 * The radio's hand on the music's final level (the engine's `musicMaster` bus): gentler music for sleep, the slow
 * sleep-timer fade, a soft pause. Ramps are smooth (no clicks) and always start from the level heard right now, so
 * a new target can interrupt a ramp in progress. Silent no-ops before Start or without WebAudio.
 */
import { audioEngine } from './audio-engine';

/** The master level when nothing turns the music down. */
export const FULL_MUSIC_LEVEL = 1;

/** Ramps the music's final level to `level` (0–1, clamped) over `seconds`. */
export function rampMusicMasterLevel(level: number, seconds: number): void {
  const engine = audioEngine();
  if (!engine) return;
  const { gain } = engine.musicMaster;
  const now = engine.ctx.currentTime;
  const target = Number.isFinite(level) ? Math.min(FULL_MUSIC_LEVEL, Math.max(0, level)) : FULL_MUSIC_LEVEL;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(target, now + Math.max(0.01, seconds));
}

/** Brings the music back to its full level (when the radio closes). */
export function restoreMusicMasterLevel(seconds = 1.5): void {
  rampMusicMasterLevel(FULL_MUSIC_LEVEL, seconds);
}
