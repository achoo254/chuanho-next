/**
 * Two-way sync of an account's data. One call carries what the device changed since its last sync and brings back
 * what the server changed since then, so the same call works for the first upload after signing in and for every
 * later refresh. Wire shape of `POST /api/sync`; deleting everything is `DELETE /api/me/data`.
 */
import { JOURNAL_MAX_ENTRIES, type JournalEntry, parseJournalEntry } from './journal';
import { isCount, isRecord } from './primitives';
import { type ProgressDoc, parseProgressDoc } from './progress';

export interface SyncRequest {
  readonly progress: ProgressDoc;
  /** Entries edited on this device since the last sync (deleted ones included). */
  readonly journal: readonly JournalEntry[];
  /** The cursor the previous response returned; 0 on the first sync of a device. */
  readonly cursor: number;
  /**
   * The data epoch the previous response returned; 0 when this device never synced this account. The server bumps the
   * epoch when the account's data is deleted: a request carrying an older epoch is a device that has not heard of the
   * wipe, so the server ignores its payload (nothing old is written back) and answers with the new epoch.
   */
  readonly epoch: number;
}

export interface SyncResponse {
  /** The merged progress (the device adopts it). */
  readonly progress: ProgressDoc;
  /** Entries the server changed after `cursor` (this device's own edits come back too, harmlessly). */
  readonly journal: readonly JournalEntry[];
  readonly cursor: number;
  /** The account's current data epoch (starts at 1). A device whose stored epoch differs must drop its local copy. */
  readonly epoch: number;
}

export function parseSyncRequest(raw: unknown): SyncRequest | null {
  if (!isRecord(raw) || !Array.isArray(raw.journal) || raw.journal.length > JOURNAL_MAX_ENTRIES) return null;
  const progress = parseProgressDoc(raw.progress);
  if (!progress || !isCount(raw.cursor, Number.MAX_SAFE_INTEGER)) return null;
  const journal = raw.journal.map(parseJournalEntry);
  if (journal.some((entry) => entry === null)) return null;
  const epoch = raw.epoch === undefined ? 0 : raw.epoch;
  if (!isCount(epoch, Number.MAX_SAFE_INTEGER)) return null;
  return { progress, journal: journal as JournalEntry[], cursor: raw.cursor, epoch };
}

export function parseSyncResponse(raw: unknown): SyncResponse | null {
  if (!isRecord(raw) || !Array.isArray(raw.journal)) return null;
  const progress = parseProgressDoc(raw.progress);
  if (!progress || !isCount(raw.cursor, Number.MAX_SAFE_INTEGER)) return null;
  // Entries that fail validation are dropped: one bad row must not block the rest.
  const journal = raw.journal.map(parseJournalEntry).filter((entry): entry is JournalEntry => entry !== null);
  if (!isCount(raw.epoch, Number.MAX_SAFE_INTEGER) || raw.epoch < 1) return null;
  return { progress, journal, cursor: raw.cursor, epoch: raw.epoch };
}
