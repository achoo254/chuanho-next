/**
 * Tells the library which tracks are actually heard, so the operator can drop the ones nobody listens to: one
 * `POST /api/library/listen` per track per music session, once it has played 30 s or half its length (whichever comes
 * first). Fire-and-forget: nothing is sent while offline, a failure is swallowed, and the body is the track id only.
 */
import { type LibraryListenInput, isLibraryListen } from '@chuanho/contract';

export const LIBRARY_LISTEN_URL = '/api/library/listen';

export interface ListenReporter {
  /** `heardS`: seconds of `track` heard since it started; reports it the first time that counts as a listen. */
  heard(track: { readonly id: string; readonly duration: number }, heardS: number): void;
}

export interface ListenReporterDeps {
  readonly send?: (trackId: string) => void;
  readonly isOnline?: () => boolean;
}

/** Posts one listen; never throws, never waits. `keepalive` lets it finish when the page is closing. */
export function sendLibraryListen(trackId: string): void {
  const body: LibraryListenInput = { trackId };
  fetch(LIBRARY_LISTEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    keepalive: true,
  }).catch(() => undefined);
}

export function createListenReporter({ send = sendLibraryListen, isOnline = () => navigator.onLine }: ListenReporterDeps = {}): ListenReporter {
  const reported = new Set<string>();
  return {
    heard(track, heardS): void {
      if (reported.has(track.id) || !isLibraryListen(heardS, track.duration)) return;
      // Offline: not marked as reported, so a later tick of the same track can still send it.
      if (!isOnline()) return;
      reported.add(track.id);
      try {
        send(track.id);
      } catch {
        // A report is never worth interrupting the music.
      }
    },
  };
}
