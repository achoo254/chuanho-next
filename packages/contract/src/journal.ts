/**
 * The karma check-in journal ("Check-in khẩu nghiệp"). Private to the player, never shared, deletable in full.
 * Every entry carries `updatedAt` and a soft-delete mark so two devices can merge without a server clock: the newest
 * edit of each id wins, and a deletion is just the newest edit.
 */
import { cleanText, isDayKey, isEpochMs, isRecord, isRecordId } from './primitives';

export const KARMA_KINDS = ['harsh', 'lie', 'gossip', 'anger'] as const;
export type KarmaKind = (typeof KARMA_KINDS)[number];

/** The three steps that dissolve a "karma cloud"; each is optional and can be skipped. */
export const RELEASE_STEPS = ['reset', 'apology', 'deed'] as const;
export type ReleaseStep = (typeof RELEASE_STEPS)[number];

export const JOURNAL_NOTE_MAX = 200;
export const JOURNAL_MAX_ENTRIES = 2000;

export interface JournalEntry {
  readonly id: string;
  readonly day: string;
  readonly kind: KarmaKind;
  readonly note: string;
  readonly released: Readonly<Record<ReleaseStep, boolean>>;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** Set when the player deleted it; kept so the deletion reaches the other device. */
  readonly deletedAt: number | null;
}

export const isKarmaKind = (value: unknown): value is KarmaKind => (KARMA_KINDS as readonly unknown[]).includes(value);

export function parseJournalEntry(raw: unknown): JournalEntry | null {
  if (!isRecord(raw)) return null;
  const { id, day, kind, note, released, createdAt, updatedAt, deletedAt } = raw;
  const cleanNote = cleanText(note ?? '', JOURNAL_NOTE_MAX);
  if (!isRecordId(id) || !isDayKey(day) || !isKarmaKind(kind) || cleanNote === null) return null;
  if (!isEpochMs(createdAt) || !isEpochMs(updatedAt)) return null;
  if (deletedAt !== null && deletedAt !== undefined && !isEpochMs(deletedAt)) return null;
  const flags = isRecord(released) ? released : {};
  return {
    id,
    day,
    kind,
    note: cleanNote,
    released: { reset: flags.reset === true, apology: flags.apology === true, deed: flags.deed === true },
    createdAt,
    updatedAt,
    deletedAt: deletedAt ?? null,
  };
}

/** A cloud is dissolved once all three steps are done. */
export const isReleased = (entry: Pick<JournalEntry, 'released'>): boolean => RELEASE_STEPS.every((step) => entry.released[step]);

/** The live (not deleted) entries, newest first. */
export const liveEntries = (entries: readonly JournalEntry[]): JournalEntry[] =>
  entries.filter((entry) => entry.deletedAt === null).sort((a, b) => b.createdAt - a.createdAt);

/** Merges two lists by id; the newer `updatedAt` wins (the incoming one on a tie). Result is not sorted. */
export function mergeJournal(current: readonly JournalEntry[], incoming: readonly JournalEntry[]): JournalEntry[] {
  const byId = new Map<string, JournalEntry>();
  for (const entry of current) byId.set(entry.id, entry);
  for (const entry of incoming) {
    const existing = byId.get(entry.id);
    if (!existing || entry.updatedAt >= existing.updatedAt) byId.set(entry.id, entry);
  }
  return [...byId.values()];
}

/** Entries per day over the last `days` days ending at `today` (oldest first) for the weekly flower chart. */
export function countByDay(entries: readonly JournalEntry[], today: string, days: number): { day: string; count: number }[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  const counts = new Map<string, number>();
  for (const entry of entries) if (entry.deletedAt === null) counts.set(entry.day, (counts.get(entry.day) ?? 0) + 1);
  const result: { day: string; count: number }[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const day = new Date(end - back * 86_400_000).toISOString().slice(0, 10);
    result.push({ day, count: counts.get(day) ?? 0 });
  }
  return result;
}
