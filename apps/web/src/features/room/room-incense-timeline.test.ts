import { describe, expect, it } from 'vitest';
import { EMPTY_RECORD, parseRoomGameRecord, withRound } from './room-game-best';
import {
  FLAME_REACTION_MS,
  GREETING_BURN,
  INTRO_FULL_MS,
  INTRO_SHORT_MS,
  LIGHT_UP_IGNITE_MS,
  gameLook,
  introDurationMs,
  introIgniteAtMs,
  introLook,
  lightUpLook,
  liveLook,
  myStickStatus,
} from './room-incense-timeline';

describe('room incense timeline', () => {
  it('plays the full intro once, then (or with reduced motion) a short one', () => {
    expect(introDurationMs(true, false)).toBe(INTRO_FULL_MS);
    expect(introDurationMs(false, false)).toBe(INTRO_SHORT_MS);
    expect(introDurationMs(true, true)).toBe(INTRO_SHORT_MS);
  });

  it('shows unlit sticks while walking, then sweeps the burn up to the greeting offering', () => {
    const ignite = introIgniteAtMs(INTRO_FULL_MS);
    expect(introLook(0, INTRO_FULL_MS, false)).toEqual({ burn: 0, smoking: false });
    const early = introLook(ignite + 50, INTRO_FULL_MS, false);
    const late = introLook(INTRO_FULL_MS, INTRO_FULL_MS, false);
    expect(early.smoking).toBe(true);
    expect(early.burn ?? 0).toBeLessThan(late.burn ?? 0);
    expect(late.burn).toBeCloseTo(GREETING_BURN);
    expect(introLook(ignite, INTRO_SHORT_MS, true).burn).toBe(GREETING_BURN);
  });

  it('links the 3D sticks to the real stick', () => {
    expect(liveLook({ kind: 'unlit' })).toEqual({ burn: 0, smoking: false });
    expect(liveLook({ kind: 'burning', progress: 0.5 })).toEqual({ burn: 0.5, smoking: true });
    expect(liveLook({ kind: 'burning', progress: 0 }).burn ?? 0).toBeGreaterThan(0);
    expect(liveLook({ kind: 'burnt' }).burn).toBeNull();
    expect(liveLook({ kind: 'outside' }).burn).toBe(GREETING_BURN);
  });

  it('reads the player stick on the server clock', () => {
    const stick = { litAt: 1_000, burnsOutAt: 11_000 };
    expect(myStickStatus({ inRoom: false, stick: null, offset: 0 }, 0)).toEqual({ kind: 'outside' });
    expect(myStickStatus({ inRoom: true, stick: null, offset: 0 }, 0)).toEqual({ kind: 'unlit' });
    // Device clock 2 s behind the server: device 4 000 is server 6 000, half burnt.
    expect(myStickStatus({ inRoom: true, stick, offset: 2_000 }, 4_000)).toEqual({ kind: 'burning', progress: 0.5 });
    expect(myStickStatus({ inRoom: true, stick, offset: 0 }, 11_000)).toEqual({ kind: 'burnt' });
  });

  it('lights up after a beat', () => {
    expect(lightUpLook(LIGHT_UP_IGNITE_MS - 1, 0.01).burn).toBe(0);
    expect(lightUpLook(LIGHT_UP_IGNITE_MS, 0.3)).toEqual({ burn: 0.3, smoking: true });
  });

  it('flickers on a gust that got through, flares on a shield, and calms on a low flame', () => {
    expect(gameLook(0.3, 5, 'gusted', 10).burn).toBe(0);
    expect(gameLook(0.3, 5, 'gusted', 130).burn).toBe(0.3);
    expect(gameLook(0.3, 5, 'shielded', 10).smoking).toBe(true);
    expect(gameLook(0.3, 2, 'shielded', FLAME_REACTION_MS).smoking).toBe(false);
    expect(gameLook(0.3, 4, 'none', 0)).toEqual({ burn: 0.3, smoking: true });
  });
});

describe('room game record', () => {
  it('reads only well-formed records', () => {
    expect(parseRoomGameRecord({ bestScore: 900, bestStars: 3, rounds: 2 })).toEqual({ bestScore: 900, bestStars: 3, rounds: 2 });
    expect(parseRoomGameRecord({ bestScore: -1, bestStars: 3, rounds: 2 })).toBeNull();
    expect(parseRoomGameRecord({ bestScore: 10, bestStars: 4, rounds: 2 })).toBeNull();
    expect(parseRoomGameRecord('900')).toBeNull();
    expect(parseRoomGameRecord(null)).toBeNull();
  });

  it('keeps the best score and stars and counts rounds', () => {
    const first = withRound(EMPTY_RECORD, 820, 2);
    expect(first).toEqual({ record: { bestScore: 820, bestStars: 2, rounds: 1 }, newBest: true });
    const second = withRound(first.record, 500, 3);
    expect(second).toEqual({ record: { bestScore: 820, bestStars: 3, rounds: 2 }, newBest: false });
  });
});
