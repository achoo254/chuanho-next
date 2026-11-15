/**
 * The bank of gentle sentences behind "Dịch sang tiếng hiền" and the apology step of releasing karma. The sentences
 * are written ahead of time by Claude and shipped as a static file (/content/gentle-phrases.json): no player text ever
 * leaves the device and no LLM runs on the server. The file is validated here because it comes over the network, and
 * by `scripts/check-gentle-bank.ts` before it is committed.
 *
 * File shape (version 1):
 *   { "version": 1,
 *     "situations": [ { "id": "late-colleague", "group": "work", "label": "Đồng nghiệp trễ việc",
 *                       "tones": { "soft": ["…"], "direct": ["…"], "funny": ["…"] } } ],
 *     "apologies": { "harsh": ["…"], "lie": ["…"], "gossip": ["…"], "anger": ["…"] } }
 */
import { KARMA_KINDS, type KarmaKind, isRecord } from '@chuanho/contract';

export const GENTLE_TONES = ['soft', 'direct', 'funny'] as const;
export type GentleTone = (typeof GENTLE_TONES)[number];

export const GENTLE_GROUPS = ['work', 'friends', 'family', 'love'] as const;
export type GentleGroup = (typeof GENTLE_GROUPS)[number];

export const GENTLE_PHRASE_MAX = 200;
export const GENTLE_BANK_URL = '/content/gentle-phrases.json';

export interface GentleSituation {
  readonly id: string;
  readonly group: GentleGroup;
  readonly label: string;
  readonly tones: Readonly<Record<GentleTone, readonly string[]>>;
}

export interface GentleBank {
  readonly situations: readonly GentleSituation[];
  readonly apologies: Readonly<Record<KarmaKind, readonly string[]>>;
}

const isGroup = (value: unknown): value is GentleGroup => (GENTLE_GROUPS as readonly unknown[]).includes(value);

/** Non-empty phrases within the length limit; anything else is dropped. */
function phrases(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0 && item.length <= GENTLE_PHRASE_MAX).map((item) => item.trim()) : [];
}

function parseSituation(raw: unknown): GentleSituation | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[a-z0-9-]{2,40}$/.test(raw.id) || !isGroup(raw.group) || typeof raw.label !== 'string' || !isRecord(raw.tones)) return null;
  const tones = { soft: phrases(raw.tones.soft), direct: phrases(raw.tones.direct), funny: phrases(raw.tones.funny) };
  // A situation needs something to say in every tone, or the tone picker would show an empty result.
  if (GENTLE_TONES.some((tone) => tones[tone].length === 0)) return null;
  return { id: raw.id, group: raw.group, label: raw.label.trim(), tones };
}

/** Validates a downloaded bank; null when it is not a usable bank (no situation, or no apology for some kind). */
export function parseGentleBank(raw: unknown): GentleBank | null {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.situations) || !isRecord(raw.apologies)) return null;
  const seen = new Set<string>();
  const situations: GentleSituation[] = [];
  for (const entry of raw.situations) {
    const situation = parseSituation(entry);
    if (situation && !seen.has(situation.id)) {
      seen.add(situation.id);
      situations.push(situation);
    }
  }
  const apologies = {} as Record<KarmaKind, string[]>;
  for (const kind of KARMA_KINDS) {
    apologies[kind] = phrases(raw.apologies[kind]);
    if (apologies[kind].length === 0) return null;
  }
  return situations.length > 0 ? { situations, apologies } : null;
}

let cached: Promise<GentleBank | null> | null = null;

/** Fetches the bank once per page load (the service worker or HTTP cache keeps it for offline); null when unavailable. */
export function loadGentleBank(): Promise<GentleBank | null> {
  cached ??= fetch(GENTLE_BANK_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then(parseGentleBank)
    .catch((error: unknown) => {
      console.warn('Gentle phrase bank unavailable', error);
      cached = null;
      return null;
    });
  return cached;
}

/** `count` apology options for a kind, starting at a varying offset so the same ones do not always lead. */
export function apologyOptions(bank: GentleBank, kind: KarmaKind, count: number, seed: number): string[] {
  const list = bank.apologies[kind];
  return Array.from({ length: Math.min(count, list.length) }, (_, i) => list[(Math.abs(seed) + i) % list.length] ?? '');
}
