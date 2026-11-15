import { describe, expect, it } from 'vitest';
import { ACTIVITIES, ACTIVITY_SPECS, type ActivityId, bubbleKey, pickActivity, pickDuration, pickLine } from './autonomy-activities';
import { seededRandom as seeded } from './seeded-random';

describe('picking a scene', () => {
  it('never repeats the scene just played and reaches every scene', () => {
    const random = seeded(7);
    const seen = new Set<ActivityId>();
    let previous: ActivityId | null = null;
    for (let i = 0; i < 400; i += 1) {
      const next = pickActivity(random, previous);
      expect(next).not.toBe(previous);
      seen.add(next);
      previous = next;
    }
    expect(seen.size).toBe(ACTIVITIES.length);
  });

  it('favours a preferred scene without forcing it', () => {
    const random = seeded(3);
    let knocks = 0;
    for (let i = 0; i < 1000; i += 1) if (pickActivity(random, 'look', 'knock') === 'knock') knocks += 1;
    expect(knocks).toBeGreaterThan(400);
    expect(knocks).toBeLessThan(1000);
  });

  it('survives a random source at its edges', () => {
    expect(ACTIVITIES).toContain(pickActivity(() => 0, null));
    expect(ACTIVITIES).toContain(pickActivity(() => 1, null));
    expect(pickActivity(() => 1, 'rest')).not.toBe('rest');
  });

  it('keeps durations within each scene’s range and lines within the three per subject', () => {
    for (const activity of ACTIVITIES) {
      const [low, high] = ACTIVITY_SPECS[activity].durationMs;
      expect(pickDuration(() => 0, activity)).toBe(low);
      expect(pickDuration(() => 1, activity)).toBe(high);
    }
    expect([pickLine(() => 0), pickLine(() => 0.5), pickLine(() => 1)]).toEqual([0, 1, 2]);
    expect(bubbleKey('pray', 2)).toBe('bubble.pray.2');
  });
});
