/**
 * Pure rules of the karma check-in journal: make an entry, edit its note, mark a release step done, delete one or
 * all. Nothing here reads the clock or storage; the caller passes `now` (epoch ms) and the local day, so every rule
 * is testable and the same functions serve the local store and, later, account sync.
 *
 * Every change moves `updatedAt` strictly forward (at least +1 ms), because `mergeJournal` lets the newer edit win:
 * an edit made in the same millisecond as the previous one must still beat it. Deleting is a soft delete
 * (`deletedAt`), so the deletion itself can travel to the server and the other devices.
 */
import { JOURNAL_NOTE_MAX, type JournalEntry, type KarmaKind, type ReleaseStep, isRecordId } from '@chuanho/contract';

export interface NewEntryInput {
  readonly kind: KarmaKind;
  readonly note: string;
}

/** When and where (which local day) a change happens, plus the id a new entry gets. */
export interface EntryStamp {
  readonly id: string;
  readonly now: number;
  readonly day: string;
}

const NO_STEPS_DONE: JournalEntry['released'] = { reset: false, apology: false, deed: false };

/** The note as stored: trimmed and cut to the contract's limit (the field also caps it, this is the last guard). */
export const cleanNote = (note: string): string => note.trim().slice(0, JOURNAL_NOTE_MAX).trim();

/** The `updatedAt` of the next change to `entry`: now, but never at or before its last change. */
const nextStamp = (entry: JournalEntry, now: number): number => Math.max(now, entry.updatedAt + 1);

/**
 * A new id made on the device (so offline entries merge later): a random UUID, which is already lowercase hex and
 * dashes (36 characters). Pages served over plain http on a LAN have no `crypto.randomUUID`, hence the fallback.
 */
export function newEntryId(random: () => number = Math.random): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid && isRecordId(uuid)) return uuid;
  const part = (): string => Math.floor(random() * 0x100000000).toString(36).padStart(7, '0');
  return `e-${Date.now().toString(36)}-${part()}${part()}`;
}

export function createEntry(input: NewEntryInput, stamp: EntryStamp): JournalEntry {
  return {
    id: stamp.id,
    day: stamp.day,
    kind: input.kind,
    note: cleanNote(input.note),
    released: NO_STEPS_DONE,
    createdAt: stamp.now,
    updatedAt: stamp.now,
    deletedAt: null,
  };
}

export function editNote(entry: JournalEntry, note: string, now: number): JournalEntry {
  const next = cleanNote(note);
  return next === entry.note ? entry : { ...entry, note: next, updatedAt: nextStamp(entry, now) };
}

/** Marks one release step done (a step is never undone: the player did the real thing). */
export function completeReleaseStep(entry: JournalEntry, step: ReleaseStep, now: number): JournalEntry {
  if (entry.released[step]) return entry;
  return { ...entry, released: { ...entry.released, [step]: true }, updatedAt: nextStamp(entry, now) };
}

export function softDelete(entry: JournalEntry, now: number): JournalEntry {
  if (entry.deletedAt !== null) return entry;
  const stamp = nextStamp(entry, now);
  return { ...entry, deletedAt: stamp, updatedAt: stamp };
}

/** "Xóa hết": every live entry becomes a deletion mark, so a later sync deletes them on the server too. */
export function softDeleteAll(entries: readonly JournalEntry[], now: number): JournalEntry[] {
  return entries.map((entry) => softDelete(entry, now));
}

/** A day key as a short `d/m` label (`2026-11-05` → `5/11`), the same in both languages. */
export function shortDayLabel(day: string): string {
  const [, month, date] = day.split('-');
  return month && date ? `${Number(date)}/${Number(month)}` : day;
}

/**
 * Keeps the stored list within `max` entries by forgetting the oldest deletion marks first; live entries are never
 * dropped. Deletion marks only matter until they have reached the server, so the oldest are the safest to forget.
 */
export function pruneDeletionMarks(entries: readonly JournalEntry[], max: number): JournalEntry[] {
  const excess = entries.length - max;
  if (excess <= 0) return [...entries];
  const forget = new Set(
    entries
      .filter((entry) => entry.deletedAt !== null)
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, excess)
      .map((entry) => entry.id),
  );
  return entries.filter((entry) => !forget.has(entry.id));
}
