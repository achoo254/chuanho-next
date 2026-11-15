import { describe, expect, it } from 'vitest';
import { FACES, FACE_PARTS, SYLLABLE_MS, chantPhaseAt, facePartsAt, isChantMouthOpen } from './face-expressions';

describe('faces', () => {
  it('has eyes and a mouth for every face', () => {
    for (const face of FACES) expect(FACE_PARTS[face]).toBeDefined();
  });

  it('closes only open eyes for a blink', () => {
    expect(facePartsAt('neutral', 0, true)).toEqual({ eyes: 'calm', mouth: 'smile' });
    expect(facePartsAt('happy', 0, true).eyes).toBe('happy');
    expect(facePartsAt('neutral', 0, false).eyes).toBe('open');
  });
});

describe('chanting mouth', () => {
  it('opens on each syllable and rests in the breath after a phrase', () => {
    expect(isChantMouthOpen(10)).toBe(true);
    expect(isChantMouthOpen(SYLLABLE_MS - 10)).toBe(false);
    expect(chantPhaseAt(SYLLABLE_MS * 8 + 100).syllable).toBe(-1);
    expect(isChantMouthOpen(SYLLABLE_MS * 8 + 100)).toBe(false);
    expect(isChantMouthOpen(-5)).toBe(false);
  });

  it('switches the chant face between the open and closed mouth', () => {
    expect(facePartsAt('chant', 10, false).mouth).toBe('o');
    expect(facePartsAt('chant', SYLLABLE_MS - 10, false).mouth).toBe('smile');
  });
});
