/**
 * The small numbers the radio shows, as pure functions: which track of this visit is playing, how many minutes were
 * heard since the radio opened, and countdowns as m:ss. The music session counts from its own start (it may have
 * been playing in the yard before), so the radio subtracts the counts it found when it opened.
 */
import type { MusicSessionStats } from '../../audio/music-session';

/** The track number in this visit: 1 for the track already playing (or the first to start), then up. */
export function radioTrackNumber(atOpen: MusicSessionStats, now: MusicSessionStats): number {
  const startedSinceOpen = Math.max(0, now.tracksStarted - atOpen.tracksStarted);
  const alreadyPlaying = atOpen.tracksStarted > 0 ? 1 : 0;
  return Math.max(1, startedSinceOpen + alreadyPlaying);
}

/** Whole minutes heard since the radio opened. */
export function radioListenedMinutes(atOpen: MusicSessionStats, now: MusicSessionStats): number {
  return Math.floor(Math.max(0, now.listenedS - atOpen.listenedS) / 60);
}

/** A countdown as m:ss, rounding up so it never shows 0:00 before the end. */
export function formatCountdown(ms: number): string {
  const totalS = Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 0;
  const minutes = Math.floor(totalS / 60);
  const seconds = totalS % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
