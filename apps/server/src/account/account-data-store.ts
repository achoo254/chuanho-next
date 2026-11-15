import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { journalEntries, progress, quietHourPeople } from '../db/schema';

/**
 * Hard-deletes everything the account keeps here (progress, the whole karma journal, its quiet-hour strokes) in one
 * transaction. The account and its sessions stay: the person is still signed in, with nothing stored. The quiet hour's
 * daily totals are anonymous sums and stay as they are.
 */
export async function deleteAccountData(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(progress).where(eq(progress.userId, userId));
    await tx.delete(journalEntries).where(eq(journalEntries.userId, userId));
    await tx.delete(quietHourPeople).where(eq(quietHourPeople.userId, userId));
  });
}
