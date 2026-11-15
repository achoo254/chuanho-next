/**
 * Whose data is on this device, and what happens to it when an account signs in. Pure.
 *
 * The device's data (progress and journal) belongs to one owner: the account whose sync bookmark is stored, or a guest
 * when there is none (see sync-state-storage.ts). The rules, for a shared device:
 * - the same account coming back just syncs;
 * - a guest's data is uploaded into the account only after the player agrees once ("merge"), or set aside ("start
 *   clean");
 * - another account's data is never uploaded: the only way on is to start clean for the account signing in;
 * - with nothing worth keeping on the device there is nothing to ask: the account starts clean at once.
 */
import { EMPTY_PROGRESS, type JournalEntry, type ProgressDoc, sameProgress } from '@chuanho/contract';

/** The question the player must answer before this account syncs. */
export type OwnershipQuestion = 'merge' | 'startClean';

export type OwnershipDecision =
  /** The device's data is already this account's. */
  | { readonly kind: 'sync' }
  /** Nothing worth keeping: wipe the leftovers (deletion marks) and sync from a clean start. */
  | { readonly kind: 'startClean' }
  | { readonly kind: 'ask'; readonly question: OwnershipQuestion };

export interface OwnershipInput {
  /** The account that owns the device's data; null = a guest (or nobody yet). */
  readonly owner: string | null;
  readonly accountId: string;
  readonly hasLocalData: boolean;
}

export function decideOwnership({ owner, accountId, hasLocalData }: OwnershipInput): OwnershipDecision {
  if (owner === accountId) return { kind: 'sync' };
  if (!hasLocalData) return { kind: 'startClean' };
  return { kind: 'ask', question: owner === null ? 'merge' : 'startClean' };
}

/** The player's answer: upload the guest's data into the account, or clear the device for it. */
export type OwnershipChoice = 'merge' | 'startClean';

/** Whether the device's data may go into `accountId`: a guest's (or its own) yes, another account's never. */
export const mergeAllowed = (owner: string | null, accountId: string): boolean => owner === null || owner === accountId;

/** Something worth asking about: a live journal entry, or progress beyond a fresh device's. */
export function hasLocalData(entries: readonly JournalEntry[], progress: ProgressDoc): boolean {
  return entries.some((entry) => entry.deletedAt === null) || !sameProgress(progress, EMPTY_PROGRESS);
}
