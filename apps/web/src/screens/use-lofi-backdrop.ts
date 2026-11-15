/** A looping, pulse-free lofi pad while `enabled` is true (chanting and endless mode backdrops). */
import { useEffect } from 'react';
import { audioEngine } from '../audio/audio-engine';
import { startBackingTrack } from '../audio/backing-track';

const BACKDROP_BPM = 68;

export function useLofiBackdrop(enabled: boolean): void {
  useEffect(() => {
    const engine = audioEngine();
    if (!enabled || !engine) return;
    const pad = startBackingTrack({ bpm: BACKDROP_BPM, startAt: engine.ctx.currentTime + 0.1, pulse: false });
    return () => pad.stop();
  }, [enabled]);
}
