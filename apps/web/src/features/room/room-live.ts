/**
 * Keeps a room screen up to date: server-sent events first (the browser reconnects them by itself), and polling the
 * snapshot every few seconds whenever the stream is down or not supported, until the stream is back. A `closed` event
 * or a poll answering that the room is gone ends it. Framework-free, with the browser parts injected so the switching
 * is tested on fakes.
 */
import type { RoomSnapshot } from '@chuanho/contract';
import { type RoomApiError, type RoomApiResult, isRoomSnapshot } from './room-api';

export const POLL_MS = 5_000;
/** After the stream failed for good (not a passing drop), try it again this much later. */
export const STREAM_RETRY_MS = 30_000;

export type LiveMode = 'connecting' | 'live' | 'polling';

/** The parts of EventSource used here. */
export interface EventSourceLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  addEventListener(type: 'closed', listener: () => void): void;
  close(): void;
}

export interface LiveHandlers {
  onSnapshot(snapshot: RoomSnapshot): void;
  onMode(mode: LiveMode): void;
  /** The room is over for this viewer: deleted, left from elsewhere, or signed out. */
  onGone(error: RoomApiError | null): void;
}

export interface LiveDeps {
  /** A new event stream, or null where EventSource does not exist. */
  openStream(): EventSourceLike | null;
  poll(): Promise<RoomApiResult<RoomSnapshot>>;
  setTimer(run: () => void, ms: number): number;
  clearTimer(id: number): void;
}

const EVENT_SOURCE_CLOSED = 2;

/** Errors after which polling stops: the room will not come back for this viewer. */
function isFinal(error: RoomApiError): boolean {
  return error.kind === 'signed-out' || (error.kind === 'room' && (error.code === 'room-not-found' || error.code === 'not-member'));
}

/** Starts following a room; returns the function that stops (call it when the screen closes). */
export function connectRoomLive(handlers: LiveHandlers, deps: LiveDeps): () => void {
  let stopped = false;
  let source: EventSourceLike | null = null;
  let pollTimer: number | null = null;
  let retryTimer: number | null = null;
  let mode: LiveMode | null = null;

  const setMode = (next: LiveMode): void => {
    if (next === mode) return;
    mode = next;
    handlers.onMode(next);
  };

  const stopPolling = (): void => {
    if (pollTimer !== null) deps.clearTimer(pollTimer);
    pollTimer = null;
  };

  const finish = (error: RoomApiError | null): void => {
    stop();
    handlers.onGone(error);
  };

  const pollOnce = async (): Promise<void> => {
    const result = await deps.poll();
    if (stopped || pollTimer === null) return;
    if (result.ok) handlers.onSnapshot(result.value);
    else if (isFinal(result.error)) {
      finish(result.error);
      return;
    }
    pollTimer = deps.setTimer(() => void pollOnce(), POLL_MS);
  };

  const startPolling = (): void => {
    if (stopped) return;
    if (source === null) setMode('polling');
    pollTimer ??= deps.setTimer(() => void pollOnce(), 0);
  };

  const openStream = (): void => {
    retryTimer = null;
    source = deps.openStream();
    if (!source) {
      startPolling();
      return;
    }
    setMode('connecting');
    const stream = source;
    stream.onopen = () => {
      setMode('live');
      stopPolling();
    };
    stream.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        data = null;
      }
      if (isRoomSnapshot(data)) handlers.onSnapshot(data);
      else console.warn('Room event without a snapshot, ignored');
    };
    stream.addEventListener('closed', () => finish(null));
    stream.onerror = () => {
      if (stopped) return;
      if (stream.readyState === EVENT_SOURCE_CLOSED) {
        // Refused (not 200) or gone for good: poll, which also says whether the room still exists, and retry later.
        stream.close();
        source = null;
        retryTimer = deps.setTimer(openStream, STREAM_RETRY_MS);
      } else {
        setMode('connecting');
      }
      startPolling();
    };
  };

  function stop(): void {
    stopped = true;
    stopPolling();
    if (retryTimer !== null) deps.clearTimer(retryTimer);
    source?.close();
    source = null;
  }

  openStream();
  return stop;
}

/** The browser's EventSource, timers and a poll through the API, for `connectRoomLive`. */
export function browserLiveDeps(url: string, poll: LiveDeps['poll']): LiveDeps {
  return {
    openStream: () => (typeof EventSource === 'function' ? new EventSource(url) : null),
    poll,
    setTimer: (run, ms) => window.setTimeout(run, ms),
    clearTimer: (id) => window.clearTimeout(id),
  };
}
