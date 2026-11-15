import { describe, expect, it } from 'vitest';
import { BLINK_MS, BLINK_WINDOW_MS, DOZE_AFTER_MS, beatBounceAt, breathAt, isBlinkingAt, shouldDoze } from './idle-motion';

describe('breathing', () => {
  it('stays small and stops with reduced motion', () => {
    for (let t = 0; t < 7000; t += 100) expect(Math.abs(breathAt(t, false))).toBeLessThanOrEqual(0.018);
    expect(breathAt(850, true)).toBe(0);
  });
});

describe('blinking', () => {
  it('blinks exactly once per window, for the blink length', () => {
    for (let window = 0; window < 20; window += 1) {
      let blinkingFrames = 0;
      for (let t = window * BLINK_WINDOW_MS; t < (window + 1) * BLINK_WINDOW_MS; t += 1) if (isBlinkingAt(t)) blinkingFrames += 1;
      expect(blinkingFrames).toBe(BLINK_MS);
    }
  });

  it('does not blink at the same moment in every window', () => {
    const starts = new Set<number>();
    for (let window = 0; window < 8; window += 1) {
      for (let t = window * BLINK_WINDOW_MS; t < (window + 1) * BLINK_WINDOW_MS; t += 1) {
        if (isBlinkingAt(t)) {
          starts.add(t - window * BLINK_WINDOW_MS);
          break;
        }
      }
    }
    expect(starts.size).toBeGreaterThan(4);
  });
});

describe('beat bounce', () => {
  it('peaks on the beat and fades before the next', () => {
    expect(beatBounceAt(1000, 500)).toBeCloseTo(1, 6);
    expect(beatBounceAt(1400, 500)).toBeLessThan(0.05);
    expect(beatBounceAt(null, 500)).toBe(0);
    expect(beatBounceAt(-200, 500)).toBe(0);
  });
});

describe('dozing', () => {
  it('nods off only after a long quiet spell', () => {
    expect(shouldDoze(DOZE_AFTER_MS - 1)).toBe(false);
    expect(shouldDoze(DOZE_AFTER_MS)).toBe(true);
  });
});
