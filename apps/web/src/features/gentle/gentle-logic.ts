/**
 * The pure steps behind the "say it gently" screen: situations grouped for the chips, which sentence to show for a
 * (situation, tone) pair and the next one on "another", and the text that is copied or shared. No React here, so a
 * new group, tone or situation only needs the bank file (and its chip label in gentle-messages.ts).
 */
import { GENTLE_GROUPS, type GentleBank, type GentleGroup, type GentleSituation } from './gentle-bank';

/** The situations of each group in file order; a group without any is left out so no chip leads nowhere. */
export function groupSituations(bank: GentleBank): Array<{ group: GentleGroup; situations: GentleSituation[] }> {
  return GENTLE_GROUPS.map((group) => ({ group, situations: bank.situations.filter((situation) => situation.group === group) })).filter(
    (entry) => entry.situations.length > 0,
  );
}

export function findSituation(bank: GentleBank, id: string | null): GentleSituation | null {
  return id === null ? null : (bank.situations.find((situation) => situation.id === id) ?? null);
}

/**
 * The first variant to show for a fresh pick: a varying start (`seed`, e.g. a random integer) so the same sentence
 * does not always lead.
 */
export function firstVariant(count: number, seed: number): number {
  return count > 0 ? Math.abs(Math.trunc(seed)) % count : 0;
}

/**
 * The variant after `current` on "another one": walks the list in a ring, so every sentence comes up once before any
 * repeats and the one just shown never comes back right away (unless it is the only one).
 */
export function nextVariant(count: number, current: number): number {
  return count > 0 ? (((current + 1) % count) + count) % count : 0;
}

/** The text that goes to the clipboard or the share sheet: the sentence alone, ready to paste into a chat. */
export function gentleShareText(sentence: string): string {
  return sentence.replace(/\s+/g, ' ').trim();
}
