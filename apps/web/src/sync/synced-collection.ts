/**
 * One kind of data the sync engine carries (progress, the journal, and later more). The engine knows nothing about
 * what is inside: each collection puts its part into the request and takes its part of the answer. A new synced kind
 * is one more object of this shape in the provider's list (plus its field in the contract's SyncRequest).
 */
import type { SyncRequest, SyncResponse } from '@chuanho/contract';

/** A sync request without the engine's own cursor. */
export type SyncPayload = Omit<SyncRequest, 'cursor'>;

export interface SyncedCollection {
  /** Stable name, used in the status when the server says this collection is full. */
  readonly key: string;
  /** The 409 error code meaning the server holds no more of this collection: it stops sending and the UI is told. */
  readonly fullCode?: string;
  /** This collection's part of the next request: what changed on the device at or after `since` (0 = everything). */
  collect(since: number): Partial<SyncPayload>;
  /** Whether a sync now would carry something new from this device. */
  hasPending(since: number): boolean;
  /** Takes this collection's part of a successful answer; `sent` is the payload that went out. */
  apply(response: SyncResponse, sent: SyncPayload): void;
  /** Forgets what it learned about the server (another account, or the server's data was deleted). */
  reset(): void;
}
