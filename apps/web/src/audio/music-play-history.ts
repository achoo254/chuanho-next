/**
 * Which music track plays next, as pure functions (no DOM, no audio), so the no-repeat promise can be tested.
 *
 * The history counts listening time on its own clock (seconds actually heard, saved across reloads) and remembers
 * at which clock reading each track last started. Picking the next track:
 *   1. a track never heard yet, at random (the first pass through the library is a shuffle without repeats);
 *   2. otherwise a track whose last start is at least `minGapS` of listening ago, at random;
 *   3. otherwise (a library shorter than the gap) the track heard longest ago.
 * With a library longer than the gap, rule 2 always has candidates, so no track repeats within `minGapS` of
 * listening, however often the page reloads.
 *
 * An optional `preferred` test (the radio's mode asks for night or morning tracks) narrows rules 1 and 2 to the
 * preferred candidates when there are any; it never widens them, so the no-repeat promise holds whatever is preferred.
 */

export interface PlayHistory {
  /** Seconds of music heard in total. */
  readonly clock: number;
  /** Track id -> clock reading when it last started. */
  readonly last: Readonly<Record<string, number>>;
}

export const EMPTY_HISTORY: PlayHistory = { clock: 0, last: {} };

/** Four hours: the shortest listening time between two plays of the same track. */
export const MIN_REPEAT_GAP_S = 4 * 3600;

export interface PickableTrack {
  readonly id: string;
}

const NOTHING_PREFERRED = (): boolean => false;

/** The next track to play, or null for an empty library. `random` returns [0, 1). */
export function pickNextTrack<T extends PickableTrack>(
  tracks: readonly T[],
  history: PlayHistory,
  random: () => number = Math.random,
  minGapS: number = MIN_REPEAT_GAP_S,
  preferred: (track: T) => boolean = NOTHING_PREFERRED,
): T | null {
  if (tracks.length === 0) return null;
  const pickFrom = (candidates: readonly T[]): T | null => {
    const liked = candidates.filter(preferred);
    const list = liked.length > 0 ? liked : candidates;
    return list[Math.min(list.length - 1, Math.floor(random() * list.length))] ?? null;
  };
  const fresh = tracks.filter((track) => history.last[track.id] === undefined);
  if (fresh.length > 0) return pickFrom(fresh);
  const rested = tracks.filter((track) => history.clock - (history.last[track.id] ?? 0) >= minGapS);
  if (rested.length > 0) return pickFrom(rested);
  // Every track has a start reading here (rule 1 found none without one).
  const startedAt = (track: T): number => history.last[track.id] ?? 0;
  return tracks.reduce((oldest, track) => (startedAt(track) < startedAt(oldest) ? track : oldest));
}

/** The history once `id` starts playing now. */
export function markStarted(history: PlayHistory, id: string): PlayHistory {
  return { clock: history.clock, last: { ...history.last, [id]: history.clock } };
}

/** The history after `seconds` more of listening (negative or non-finite amounts are ignored). */
export function addListened(history: PlayHistory, seconds: number): PlayHistory {
  if (!Number.isFinite(seconds) || seconds <= 0) return history;
  return { clock: history.clock + seconds, last: history.last };
}

/** Drops tracks that left the library, so the stored history does not grow forever. */
export function pruneHistory(history: PlayHistory, ids: ReadonlySet<string>): PlayHistory {
  const last: Record<string, number> = {};
  for (const [id, at] of Object.entries(history.last)) if (ids.has(id)) last[id] = at;
  return { clock: history.clock, last };
}

/** A stored history if it has the right shape, else null (corrupt or foreign data starts afresh). */
export function parsePlayHistory(raw: unknown): PlayHistory | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { clock, last } = raw as { clock?: unknown; last?: unknown };
  if (typeof clock !== 'number' || !Number.isFinite(clock) || clock < 0) return null;
  if (typeof last !== 'object' || last === null || Array.isArray(last)) return null;
  const clean: Record<string, number> = {};
  for (const [id, at] of Object.entries(last as Record<string, unknown>)) {
    if (typeof at === 'number' && Number.isFinite(at) && at >= 0 && at <= clock) clean[id] = at;
  }
  return { clock, last: clean };
}
