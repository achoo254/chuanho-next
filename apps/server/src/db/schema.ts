import type { KarmaKind, ProgressDoc } from '@chuanho/contract';
import { bigint, boolean, index, integer, jsonb, pgSequence, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * An account of the hoandat.com IdP that signed in here: its `sub` and a short display name (the given name its
 * userinfo gave at the latest sign-in). Never an email address. Deleting the row deletes everything below by cascade.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  sub: text('sub').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

/** Web sessions. `id` is the sha256 of the opaque cookie token, never the token itself. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/** The account's merged progress (counters and preferences), one document per account, as the contract shapes it. */
export const progress = pgTable('progress', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  doc: jsonb('doc').$type<ProgressDoc>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

/** Hands out the sync cursor: every write of a journal row takes the next value, so "newer than the cursor" is exact. */
export const journalServerSeq = pgSequence('journal_server_seq');

/**
 * The karma check-in journal. The id is made on the device, so the key is (account, id). Times are the device's epoch
 * milliseconds; `deleted_at` marks a deletion that still has to reach the other devices (its note is emptied).
 */
export const journalEntries = pgTable(
  'journal_entries',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    day: text('day').notNull(),
    kind: text('kind').$type<KarmaKind>().notNull(),
    note: text('note').notNull(),
    releasedReset: boolean('released_reset').notNull(),
    releasedApology: boolean('released_apology').notNull(),
    releasedDeed: boolean('released_deed').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).notNull(),
    updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
    deletedAt: bigint('deleted_at', { mode: 'number' }),
    serverSeq: bigint('server_seq', { mode: 'number' })
      .notNull()
      .default(sql`nextval('journal_server_seq')`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.id] }), index('journal_entries_user_seq_idx').on(table.userId, table.serverSeq)],
);

/** "Giờ Tĩnh": the shared count of mõ strokes of each Vietnam day. */
export const quietHourDays = pgTable('quiet_hour_days', {
  day: text('day').primaryKey(),
  total: integer('total').notNull(),
});

/** Strokes each account added on a day, to hold everyone to the per-person cap. */
export const quietHourPeople = pgTable(
  'quiet_hour_people',
  {
    day: text('day').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    count: integer('count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.userId] }), index('quiet_hour_people_user_id_idx').on(table.userId)],
);
