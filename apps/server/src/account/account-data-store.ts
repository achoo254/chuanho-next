import { vietnamDay } from '@chuanho/contract';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { journalEntries, progress, quietHourPeople, users } from '../db/schema';
import { lockAccount } from './account-lock';

/**
 * Hard-deletes everything the account keeps here (progress, the whole karma journal, its quiet-hour strokes of past
 * days) in one transaction, under the same row lock a sync takes, and bumps the account's data epoch so a device that
 * synced before the wipe cannot write the old data back. The account and its sessions stay: the person is still
 * signed in, with nothing stored.
 *
 * Today's quiet-hour row stays: it holds only a stroke count, and dropping it would hand the person a fresh per-night
 * cap on every delete. The quiet hour's daily totals are anonymous sums and stay as they are.
 */
export async function deleteAccountData(db: Db, userId: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    await lockAccount(tx, userId);
    await tx.delete(progress).where(eq(progress.userId, userId));
    await tx.delete(journalEntries).where(eq(journalEntries.userId, userId));
    await tx.delete(quietHourPeople).where(and(eq(quietHourPeople.userId, userId), lt(quietHourPeople.day, vietnamDay(now.getTime()))));
    await tx
      .update(users)
      .set({ dataEpoch: sql`${users.dataEpoch} + 1` })
      .where(eq(users.id, userId));
  });
}
