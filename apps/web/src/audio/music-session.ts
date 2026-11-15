/**
 * What a background-music session offers the screens: the shared session is started and stopped by
 * background-music.ts; a screen that steers the music (the radio) gets the `MusicControls` part only.
 */

export interface MusicSessionStats {
  /** Tracks started since this session began (skips included). */
  readonly tracksStarted: number;
  /** Seconds of music actually heard since this session began. */
  readonly listenedS: number;
}

export interface MusicControls {
  /** Fades into the next track now. */
  skip(): void;
  /** Pauses the music where it is (and stops using up the library), or carries on. */
  setPaused(paused: boolean): void;
  /** Tracks carrying any of these tags are picked first (no-repeat rules still win); empty clears it. */
  setPreferredTags(tags: readonly string[]): void;
  stats(): MusicSessionStats;
}

export interface Session extends MusicControls {
  stop(): void;
}

export const NO_STATS: MusicSessionStats = { tracksStarted: 0, listenedS: 0 };
