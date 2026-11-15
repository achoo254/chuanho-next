import { QUIET_HOUR_PERSON_CAP } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { acceptedStrokes, beatsAcceptedNow, quietHourStatus } from './quiet-hour-rules';

/** 22:30 Vietnam time (UTC+7) on 2026-11-15 is 15:30 UTC. */
const START = Date.parse('2026-11-15T15:30:00Z');
const MINUTE = 60_000;

describe('quiet hour status', () => {
  it('is open from 22:30 to 23:00 Vietnam time', () => {
    expect(quietHourStatus(START - 1, 0).open).toBe(false);
    expect(quietHourStatus(START, 0)).toEqual({
      day: '2026-11-15',
      open: true,
      startsAt: START,
      endsAt: START + 30 * MINUTE,
      total: 0,
      milestones: [],
      serverNow: START,
    });
    expect(quietHourStatus(START + 30 * MINUTE, 0).open).toBe(false);
  });

  it("keeps tonight's window and total until Vietnam midnight", () => {
    const late = quietHourStatus(START + 60 * MINUTE, 5200);
    expect(late).toMatchObject({ day: '2026-11-15', open: false, startsAt: START, total: 5200, milestones: [1000, 5000] });
    expect(quietHourStatus(START + 90 * MINUTE, 0).day).toBe('2026-11-16');
  });
});

describe('beats', () => {
  it('count only inside the window and for tonight', () => {
    expect(beatsAcceptedNow({ day: '2026-11-15', count: 10 }, START + MINUTE)).toBe(true);
    expect(beatsAcceptedNow({ day: '2026-11-14', count: 10 }, START + MINUTE)).toBe(false);
    expect(beatsAcceptedNow({ day: '2026-11-15', count: 10 }, START - MINUTE)).toBe(false);
    expect(beatsAcceptedNow({ day: '2026-11-15', count: 10 }, START + 30 * MINUTE)).toBe(false);
  });

  it('are clamped to the per-person cap', () => {
    expect(acceptedStrokes(0, 80)).toBe(80);
    expect(acceptedStrokes(QUIET_HOUR_PERSON_CAP - 30, 80)).toBe(30);
    expect(acceptedStrokes(QUIET_HOUR_PERSON_CAP, 80)).toBe(0);
    expect(acceptedStrokes(QUIET_HOUR_PERSON_CAP + 5, 80)).toBe(0);
  });
});
