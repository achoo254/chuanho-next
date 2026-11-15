/** The quiet hour's counters: one shared total per Vietnam day and each account's own strokes of that day. */
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { quietHourDays, quietHourPeople } from '../db/schema';
import { acceptedStrokes } from './quiet-hour-rules';

export async function readQuietHourTotal(db: Db, day: string): Promise<number> {
  const [row] = await db.select({ total: quietHourDays.total }).from(quietHourDays).where(eq(quietHourDays.day, day));
  return row?.total ?? 0;
}

/**
 * Adds what fits of `requested` strokes under the account's cap for `day` and returns the day's new total. The
 * account's row is locked first, so two batches of one account at once cannot both pass the cap.
 */
export async function addQuietHourStrokes(db: Db, userId: string, day: string, requested: number): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.insert(quietHourPeople).values({ day, userId, count: 0 }).onConflictDoNothing();
    const [mine] = await tx
      .select({ count: quietHourPeople.count })
      .from(quietHourPeople)
      .where(and(eq(quietHourPeople.day, day), eq(quietHourPeople.userId, userId)))
      .for('update');
    const accepted = acceptedStrokes(mine?.count ?? 0, requested);
    if (accepted === 0) {
      const [row] = await tx.select({ total: quietHourDays.total }).from(quietHourDays).where(eq(quietHourDays.day, day));
      return row?.total ?? 0;
    }
    await tx
      .update(quietHourPeople)
      .set({ count: sql`${quietHourPeople.count} + ${accepted}` })
      .where(and(eq(quietHourPeople.day, day), eq(quietHourPeople.userId, userId)));
    const [shared] = await tx
      .insert(quietHourDays)
      .values({ day, total: accepted })
      .onConflictDoUpdate({ target: quietHourDays.day, set: { total: sql`${quietHourDays.total} + ${accepted}` } })
      .returning({ total: quietHourDays.total });
    return shared?.total ?? accepted;
  });
}
