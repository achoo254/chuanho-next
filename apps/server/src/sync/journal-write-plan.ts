/**
 * Which incoming journal edits the server keeps, decided by the contract's own rule (`mergeJournal`: per id the newer
 * `updatedAt` wins, the incoming one on a tie), so server and devices can never disagree. Pure, no database.
 */
import { type JournalEntry, mergeJournal } from '@chuanho/contract';

export interface JournalWritePlan {
  /** Incoming entries that win over what is stored (or are new), ready to store. */
  readonly writes: readonly JournalEntry[];
  /** How many of `writes` are ids the account does not have yet. */
  readonly newCount: number;
  /** Ids the device sent an older edit of: the stored version goes back to it whatever its cursor. */
  readonly staleIds: readonly string[];
}

/** A deleted entry keeps only what the other devices need to drop it: its note is not kept. */
export const forStorage = (entry: JournalEntry): JournalEntry => (entry.deletedAt === null ? entry : { ...entry, note: '' });

export function planJournalWrites(stored: readonly JournalEntry[], incoming: readonly JournalEntry[]): JournalWritePlan {
  const storedEntries = new Set(stored);
  const storedIds = new Set(stored.map((entry) => entry.id));
  const merged = mergeJournal(stored, incoming);
  const writes = merged.filter((entry) => !storedEntries.has(entry)).map(forStorage);
  const winners = new Map(merged.map((entry) => [entry.id, entry]));
  const staleIds = [...new Set(incoming.map((entry) => entry.id))].filter((id) => {
    const winner = winners.get(id);
    return winner !== undefined && storedEntries.has(winner);
  });
  return { writes, newCount: writes.filter((entry) => !storedIds.has(entry.id)).length, staleIds };
}
