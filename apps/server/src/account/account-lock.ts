import { eq } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { users } from '../db/schema';
import { HttpError } from '../http-error';

/**
 * Locks the account's row for the rest of the transaction and returns its data epoch. Every write to the account's
 * data (a sync, "delete all my data") takes this lock first, so they run one after the other: a delete either sees a
 * sync's rows and removes them, or the sync runs after it and finds the new epoch. A missing row is an account deleted
 * while this request was in flight.
 */
export async function lockAccount(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx.select({ epoch: users.dataEpoch }).from(users).where(eq(users.id, userId)).for('update');
  if (!row) throw new HttpError(401, 'sign-in-required');
  return row.epoch;
}
