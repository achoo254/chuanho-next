/**
 * Every effect has several recorded takes (public/audio/<group>-NN.*). Which take plays, and how it is varied, is
 * decided here as pure functions: a random take but never the one that just played, a pitch within +-3 % and a
 * level within about +-1 dB, so a run of strikes never sounds like a machine.
 */

/** URLs of `count` takes named `<group>-01.<ext>` … under /audio/. */
export function takeUrls(group: string, count: number, ext: 'wav' | 'mp3'): readonly string[] {
  return Array.from({ length: count }, (_, i) => `/audio/${group}-${String(i + 1).padStart(2, '0')}.${ext}`);
}

/** Index of the take to play among `available` loaded takes, never `last` when there is a choice. */
export function pickTakeIndex(available: number, last: number, random: () => number = Math.random): number {
  if (available <= 1) return 0;
  // Draw among the others, then step over `last`: uniform, and never the same twice in a row.
  const index = Math.min(available - 2, Math.floor(random() * (available - 1)));
  return last >= 0 && last < available && index >= last ? index + 1 : index;
}

export interface TakeVariation {
  /** Playback rate: 0.97 to 1.03 (a pitch change of about half a semitone either way). */
  readonly rate: number;
  /** Gain factor: 0.89 to 1.12 (about -1 dB to +1 dB). */
  readonly gain: number;
}

export function takeVariation(random: () => number = Math.random): TakeVariation {
  return { rate: 0.97 + random() * 0.06, gain: 0.89 + random() * 0.23 };
}
