/**
 * What a successful sync answer does to the device, apart from the engine's scheduling.
 *
 * Normally each collection takes its part and the bookmark moves on; `lastSyncedAt` only moves once no collection holds
 * changes back, so a sync spread over several requests is counted as done when its last request went through.
 *
 * Data epoch: when the server answers another epoch than the device's (non-zero) one, the account's data was deleted
 * from another device and the server wrote nothing of this upload. The device then drops its copy of the synced data,
 * takes the server's current state, and uploads nothing older than now, so deleted data never comes back from a device
 * that missed the deletion.
 */
import { EMPTY_PROGRESS, type SyncResponse } from '@chuanho/contract';
import type { SyncBookmark } from './sync-state-storage';
import type { SyncPayload, SyncedCollection } from './synced-collection';

export const EMPTY_PAYLOAD: SyncPayload = { progress: EMPTY_PROGRESS, journal: [] };

export interface SyncAnswerContext {
  readonly collections: readonly SyncedCollection[];
  /** The collections still sending (not reported full). */
  readonly active: readonly SyncedCollection[];
  discardLocal(): void;
  readonly now: number;
}

export interface TakenSyncAnswer {
  readonly bookmark: SyncBookmark;
  /** Some collection held changes back: send again right away. */
  readonly more: boolean;
}

export const wipedElsewhere = (stored: number, answered: number): boolean => stored !== 0 && answered !== stored;

export function takeSyncAnswer(
  context: SyncAnswerContext,
  current: SyncBookmark,
  response: SyncResponse,
  sent: SyncPayload,
  startedAt: number,
): TakenSyncAnswer {
  const { collections, active } = context;
  const base = { accountId: current.accountId, cursor: response.cursor, epoch: response.epoch };
  if (wipedElsewhere(current.epoch, response.epoch)) {
    for (const collection of collections) collection.reset();
    context.discardLocal();
    for (const collection of collections) collection.apply(response, EMPTY_PAYLOAD);
    return { bookmark: { ...base, lastSyncedAt: context.now + 1 }, more: false };
  }
  for (const collection of collections) collection.apply(response, sent);
  const more = active.some((collection) => collection.hasMore?.() ?? false);
  return { bookmark: { ...base, lastSyncedAt: more ? current.lastSyncedAt : startedAt }, more };
}
