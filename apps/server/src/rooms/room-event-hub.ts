/**
 * Live room updates over server-sent events: each open stream belongs to one member of one room. Changes to a room are
 * coalesced (one push per COALESCE_MS at most), and each push serializes the shared part of the snapshot once and adds
 * only `meId` / `myReportedWishId` per stream. A comment line every 25 s keeps proxies from closing an idle stream; a
 * deleted room (or a member who left) gets one `closed` event before its streams end; a member the host removed gets
 * it with the reason. A stream whose client stops
 * reading is dropped instead of buffering without bound. Plain HTTP that nginx passes through.
 */
import type { RoomClosedReason, RoomSnapshot } from '@chuanho/contract';
import { RoomError, type ViewerFields } from './room-model';
import type { RoomStreamView } from './room-store';

/** What a stream writes to; an express Response satisfies it. */
export interface EventSink {
  /** False when the chunk had to be buffered (the client is not keeping up). */
  write(chunk: string): boolean;
  end(): unknown;
  /** Closes at once without flushing (for a client that stopped reading). */
  destroy?(): unknown;
  /** Bytes buffered and not yet sent. */
  readonly writableLength?: number;
}

export interface RoomEventHubOptions {
  readonly coalesceMs?: number;
  readonly streamsPerUser?: number;
  readonly streamsTotal?: number;
}

export const HEARTBEAT_MS = 25_000;
export const COALESCE_MS = 250;
/** Streams one account may hold open (tabs, devices), across all rooms. */
export const STREAMS_PER_USER = 3;
/** Streams the whole server holds open. */
export const STREAMS_TOTAL = 500;
/** A stream with this much unsent, or refused this many writes in a row, is dropped. */
const MAX_BUFFERED_BYTES = 512 * 1024;
const MAX_REFUSED_WRITES = 8;

interface Stream {
  readonly userId: string;
  readonly sink: EventSink;
  refusedWrites: number;
}

export const snapshotEvent = (snapshot: RoomSnapshot): string => `data: ${JSON.stringify(snapshot)}\n\n`;
/** The shared part serialized once (`{…` without its closing brace), finished per viewer. */
export const viewerEvent = (sharedHead: string, fields: ViewerFields): string =>
  `data: ${sharedHead},"meId":${JSON.stringify(fields.meId)},"myReportedWishId":${JSON.stringify(fields.myReportedWishId)}}\n\n`;
export const CLOSED_EVENT = 'event: closed\ndata: {}\n\n';
/** The `closed` event that also says why (its data is a RoomClosedEvent). */
export const closedEvent = (reason: RoomClosedReason): string => `event: closed\ndata: ${JSON.stringify({ reason })}\n\n`;
const HEARTBEAT = ': keep-alive\n\n';

export class RoomEventHub {
  private readonly streams = new Map<string, Set<Stream>>();
  private readonly perUser = new Map<string, number>();
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private total = 0;
  private readonly coalesceMs: number;
  private readonly streamsPerUser: number;
  private readonly streamsTotal: number;

  /** @param viewOf the room for its streams now, or null when it is gone. */
  constructor(
    private readonly viewOf: (code: string) => RoomStreamView | null,
    options: RoomEventHubOptions = {},
  ) {
    this.coalesceMs = options.coalesceMs ?? COALESCE_MS;
    this.streamsPerUser = options.streamsPerUser ?? STREAMS_PER_USER;
    this.streamsTotal = options.streamsTotal ?? STREAMS_TOTAL;
  }

  /** Refuses (`too-many-streams`) one more stream for this account or for the server; call before answering. */
  assertCapacity(userId: string): void {
    if (this.total >= this.streamsTotal || (this.perUser.get(userId) ?? 0) >= this.streamsPerUser) throw new RoomError('too-many-streams');
  }

  /** Starts a stream with the current snapshot; returns the function that forgets it (call on disconnect). */
  open(code: string, userId: string, sink: EventSink, first: RoomSnapshot): () => void {
    this.assertCapacity(userId);
    const room = this.streams.get(code) ?? new Set<Stream>();
    this.streams.set(code, room);
    const stream: Stream = { userId, sink, refusedWrites: 0 };
    room.add(stream);
    this.total += 1;
    this.perUser.set(userId, (this.perUser.get(userId) ?? 0) + 1);
    this.safeWrite(code, stream, snapshotEvent(first));
    this.startHeartbeat();
    return () => this.forget(code, stream);
  }

  /** Pushes the room's state to its streams within COALESCE_MS; changes in between ride along in the same push. */
  broadcast(code: string): void {
    if (this.pending.has(code) || !this.streams.has(code)) return;
    const timer = setTimeout(() => {
      this.pending.delete(code);
      this.push(code);
    }, this.coalesceMs);
    timer.unref();
    this.pending.set(code, timer);
  }

  /** The room is gone: tell every stream and end it. */
  closeRoom(code: string): void {
    const timer = this.pending.get(code);
    if (timer) clearTimeout(timer);
    this.pending.delete(code);
    for (const stream of this.streams.get(code) ?? []) this.end(code, stream);
  }

  /** One viewer is out of the room (removed by the host): tell each of their streams why and end it. */
  closeViewer(code: string, userId: string, reason: RoomClosedReason): void {
    for (const stream of [...(this.streams.get(code) ?? [])]) {
      if (stream.userId === userId) this.end(code, stream, closedEvent(reason));
    }
  }

  /** Open streams across all rooms. */
  get size(): number {
    return this.total;
  }

  private push(code: string): void {
    const view = this.viewOf(code);
    if (!view) {
      this.closeRoom(code);
      return;
    }
    const sharedHead = JSON.stringify(view.shared).slice(0, -1);
    for (const stream of this.streams.get(code) ?? []) {
      const fields = view.viewer(stream.userId);
      if (fields) this.safeWrite(code, stream, viewerEvent(sharedHead, fields));
      else this.end(code, stream);
    }
  }

  private end(code: string, stream: Stream, closed: string = CLOSED_EVENT): void {
    this.safeWrite(code, stream, closed);
    try {
      stream.sink.end();
    } catch {
      // The socket is already gone; forgetting it is all that is left.
    }
    this.forget(code, stream);
  }

  private forget(code: string, stream: Stream): void {
    const room = this.streams.get(code);
    if (!room?.delete(stream)) return;
    this.total -= 1;
    const left = (this.perUser.get(stream.userId) ?? 1) - 1;
    if (left > 0) this.perUser.set(stream.userId, left);
    else this.perUser.delete(stream.userId);
    if (room.size === 0) this.streams.delete(code);
    if (this.streams.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  /** Writes, or drops a stream whose client stopped reading (too much buffered, or refused writes in a row). */
  private safeWrite(code: string, stream: Stream, chunk: string): void {
    try {
      stream.refusedWrites = stream.sink.write(chunk) ? 0 : stream.refusedWrites + 1;
    } catch {
      this.forget(code, stream);
      return;
    }
    if (stream.refusedWrites < MAX_REFUSED_WRITES && (stream.sink.writableLength ?? 0) <= MAX_BUFFERED_BYTES) return;
    try {
      if (stream.sink.destroy) stream.sink.destroy();
      else stream.sink.end();
    } catch {
      // Already gone.
    }
    this.forget(code, stream);
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
