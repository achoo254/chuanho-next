/**
 * One background-music session shared by every screen that wants music (sutra, endless mode, idle play, …):
 * `acquireBackgroundMusic` counts the callers, and the music stops a moment after the last one releases, so moving
 * between modes does not restart it. Plays the AI library (music-library-player.ts), or the bundled pad loop where
 * media elements cannot feed WebAudio.
 */
import { audioEngine } from './audio-engine';
import { startBackingTrack } from './backing-track';
import { FALLBACK_BPM, type Session, startLibrarySession } from './music-library-player';

const RELEASE_GRACE_MS = 1500;

let users = 0;
let session: Session | null = null;
let releaseTimer: number | null = null;

/** Starts the background music if it is not playing; returns the release for this caller. Silent before Start. */
export function acquireBackgroundMusic(): () => void {
  const engine = audioEngine();
  if (!engine) return () => undefined;
  users += 1;
  if (releaseTimer !== null) {
    window.clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!session) {
    session = engine.musicDecks
      ? startLibrarySession(engine.ctx, engine.musicDecks)
      : (() => {
          const pad = startBackingTrack({ bpm: FALLBACK_BPM, startAt: engine.ctx.currentTime + 0.1, pulse: false });
          return { stop: () => pad.stop() };
        })();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users = Math.max(0, users - 1);
    if (users > 0) return;
    releaseTimer = window.setTimeout(() => {
      releaseTimer = null;
      if (users === 0) {
        session?.stop();
        session = null;
      }
    }, RELEASE_GRACE_MS);
  };
}
