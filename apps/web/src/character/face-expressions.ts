/**
 * The character's faces as pairs of drawn parts (eyes and mouth) and the small timing rules that bring them alive:
 * the mouth moving while chanting, and which eyes a blink shows. Pure, so the timing is tested apart from the scene.
 */

export const EYE_SHAPES = ['open', 'happy', 'calm', 'sleepy'] as const;
export type EyeShape = (typeof EYE_SHAPES)[number];
export const MOUTH_SHAPES = ['smile', 'grin', 'o'] as const;
export type MouthShape = (typeof MOUTH_SHAPES)[number];

export const FACES = ['neutral', 'happy', 'sleepy', 'perfect', 'calm', 'chant', 'surprised'] as const;
export type FaceName = (typeof FACES)[number];

export interface FaceParts {
  readonly eyes: EyeShape;
  readonly mouth: MouthShape;
}

export const FACE_PARTS: Readonly<Record<FaceName, FaceParts>> = {
  neutral: { eyes: 'open', mouth: 'smile' },
  happy: { eyes: 'happy', mouth: 'smile' },
  perfect: { eyes: 'happy', mouth: 'grin' },
  sleepy: { eyes: 'sleepy', mouth: 'o' },
  calm: { eyes: 'calm', mouth: 'smile' },
  chant: { eyes: 'calm', mouth: 'o' },
  surprised: { eyes: 'open', mouth: 'o' },
};

/** One chanted syllable, of which the mouth is open the first part; a breath after each phrase. */
export const SYLLABLE_MS = 320;
const SYLLABLE_OPEN_MS = 170;
const PHRASE_SYLLABLES = 8;
const PHRASE_BREATH_MS = 700;
const PHRASE_MS = PHRASE_SYLLABLES * SYLLABLE_MS + PHRASE_BREATH_MS;

/** Where in its phrase a chant is: the syllable index (−1 in the breath) and how far into that syllable. */
export function chantPhaseAt(elapsedMs: number): { syllable: number; intoMs: number } {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return { syllable: -1, intoMs: 0 };
  const inPhrase = elapsedMs % PHRASE_MS;
  const syllable = Math.floor(inPhrase / SYLLABLE_MS);
  if (syllable >= PHRASE_SYLLABLES) return { syllable: -1, intoMs: inPhrase - PHRASE_SYLLABLES * SYLLABLE_MS };
  return { syllable, intoMs: inPhrase - syllable * SYLLABLE_MS };
}

export function isChantMouthOpen(elapsedMs: number): boolean {
  const { syllable, intoMs } = chantPhaseAt(elapsedMs);
  return syllable >= 0 && intoMs < SYLLABLE_OPEN_MS;
}

/** The parts a face shows at a moment: the chanting mouth moves, and open eyes close for a blink. */
export function facePartsAt(face: FaceName, chantElapsedMs: number, blinking: boolean): FaceParts {
  const parts = FACE_PARTS[face];
  const mouth = face === 'chant' && !isChantMouthOpen(chantElapsedMs) ? 'smile' : parts.mouth;
  const eyes = blinking && parts.eyes === 'open' ? 'calm' : parts.eyes;
  return { eyes, mouth };
}
