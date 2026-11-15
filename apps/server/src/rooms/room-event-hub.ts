/**
 * Live room updates over server-sent events: each open stream belongs to one member of one room, every change pushes
 * the whole snapshot as that member sees it (own `meId`), a comment line every 25 s keeps proxies from closing an idle
 * stream, and a deleted room (or a member who left) gets one `closed` event before its streams end. Plain HTTP that
 * nginx passes through; enough for a few dozen people per room.
 */
import type { RoomSnapshot } from '@chuanho/contract';

/** What a stream writes to; an express Response satisfies it. */
export interface EventSink {
  write(chunk: string): unknown;
  end(): unknown;
}

export const HEARTBEAT_MS = 25_000;
/** Streams one member may hold open in one room (tabs, devices); the oldest goes when another opens. */
export const STREAMS_PER_MEMBER = 3;

interface Stream {
  readonly userId: string;
  readonly sink: EventSink;
}

export const snapshotEvent = (snapshot: RoomSnapshot): string => `data: ${JSON.stringify(snapshot)}\n\n`;
export const CLOSED_EVENT = 'event: closed\ndata: {}\n\n';
const HEARTBEAT = ': keep-alive\n\n';

export class RoomEventHub {
  private readonly streams = new Map<string, Set<Stream>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  /** @param snapshotFor the room as one member sees it now, or null when the room is gone or they left. */
  constructor(private readonly snapshotFor: (code: string, userId: string) => RoomSnapshot | null) {}

  /** Starts a stream with the current snapshot; returns the function that forgets it (call on disconnect). */
  open(code: string, userId: string, sink: EventSink, first: RoomSnapshot): () => void {
    const room = this.streams.get(code) ?? new Set<Stream>();
    this.streams.set(code, room);
    const own = [...room].filter((stream) => stream.userId === userId);
    for (const extra of own.slice(0, Math.max(0, own.length - STREAMS_PER_MEMBER + 1))) this.end(code, extra);
    const stream: Stream = { userId, sink };
    room.add(stream);
    this.safeWrite(code, stream, snapshotEvent(first));
    this.startHeartbeat();
    return () => this.forget(code, stream);
  }

  /** Pushes the room's current state to every stream in it; members who are no longer in it are closed. */
  broadcast(code: string): void {
    for (const stream of this.streams.get(code) ?? []) {
      const snapshot = this.snapshotFor(code, stream.userId);
      if (snapshot) this.safeWrite(code, stream, snapshotEvent(snapshot));
      else this.end(code, stream);
    }
  }

  /** The room is gone: tell every stream and end it. */
  closeRoom(code: string): void {
    for (const stream of this.streams.get(code) ?? []) this.end(code, stream);
  }

  /** Open streams across all rooms. */
  get size(): number {
    let total = 0;
    for (const room of this.streams.values()) total += room.size;
    return total;
  }

  private end(code: string, stream: Stream): void {
    this.safeWrite(code, stream, CLOSED_EVENT);
    try {
      stream.sink.end();
    } catch {
      // The socket is already gone; forgetting it is all that is left.
    }
    this.forget(code, stream);
  }

  private forget(code: string, stream: Stream): void {
    const room = this.streams.get(code);
    if (!room) return;
    room.delete(stream);
    if (room.size === 0) this.streams.delete(code);
    if (this.streams.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private safeWrite(code: string, stream: Stream, chunk: string): void {
    try {
      stream.sink.write(chunk);
    } catch {
      this.forget(code, stream);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      for (const [code, room] of this.streams) for (const stream of room) this.safeWrite(code, stream, HEARTBEAT);
    }, HEARTBEAT_MS);
    // Never what keeps the process alive.
    this.heartbeat.unref();
  }
}
