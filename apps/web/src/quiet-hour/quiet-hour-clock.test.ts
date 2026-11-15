import { type QuietHourStatus, quietHourWindow } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { POLL_IDLE_MS, POLL_OPEN_MS, QUIET_HOUR_START_LABEL, nextPollDelay, quietHourView, serverOffset } from './quiet-hour-clock';
import { parseQuietHourStatus } from './quiet-hour-status';

const DAY = '2027-01-15';
const { start, end } = quietHourWindow(DAY);
const MIN = 60_000;
const status = (total: number, serverNow = start): QuietHourStatus => ({ day: DAY, open: true, startsAt: start, endsAt: end, total, milestones: [], serverNow });

describe('quietHourView', () => {
  it('is hidden without a status or long before the half hour', () => {
    expect(quietHourView(null, start)).toEqual({ phase: 'hidden' });
    expect(quietHourView(status(0), start - 3 * 60 * MIN)).toEqual({ phase: 'hidden' });
  });

  it('counts down in the hour before, in whole minutes', () => {
    expect(quietHourView(status(0), start - 12 * MIN)).toEqual({ phase: 'before', minutes: 12 });
    expect(quietHourView(status(0), start - 11.5 * MIN)).toEqual({ phase: 'before', minutes: 12 });
    expect(quietHourView(status(0), start - 10_000)).toEqual({ phase: 'before', minutes: 1 });
  });

  it('shows the running total, minutes left and milestones while it is on', () => {
    expect(quietHourView(status(5200), start + 10 * MIN)).toEqual({ phase: 'open', minutes: 20, total: 5200, milestones: [1000, 5000] });
  });

  it("shows tonight's total after it ends, until a new day", () => {
    expect(quietHourView(status(1500), end + 5 * MIN)).toEqual({ phase: 'after', total: 1500, milestones: [1000] });
    expect(quietHourView(status(0), end + 5 * MIN)).toEqual({ phase: 'hidden' });
  });

  it("does not show yesterday's total", () => {
    const tomorrow = quietHourWindow('2027-01-16').start;
    expect(quietHourView(status(9000), tomorrow + MIN)).toMatchObject({ phase: 'open', total: 0, milestones: [] });
  });
});

describe('quiet hour timing', () => {
  it('learns the server clock offset', () => {
    expect(serverOffset(10_000, 7_000)).toBe(3_000);
    expect(serverOffset(7_000, 10_000)).toBe(-3_000);
  });

  it('polls every 30 s while on, otherwise every 5 minutes or right at the start', () => {
    expect(nextPollDelay(start + MIN)).toBe(POLL_OPEN_MS);
    expect(nextPollDelay(start - 3 * 60 * MIN)).toBe(POLL_IDLE_MS);
    expect(nextPollDelay(start - 2 * MIN)).toBe(2 * MIN + 1_000);
  });

  it('labels the start time from the contract', () => {
    expect(QUIET_HOUR_START_LABEL).toBe('22:30');
  });
});

describe('parseQuietHourStatus', () => {
  it('accepts the server answer and rejects malformed ones', () => {
    expect(parseQuietHourStatus(status(3))).toEqual(status(3));
    expect(parseQuietHourStatus({ ...status(3), day: 'today' })).toBeNull();
    expect(parseQuietHourStatus({ ...status(3), endsAt: start })).toBeNull();
    expect(parseQuietHourStatus({ ...status(3), milestones: [1000, 'x'] })).toBeNull();
    expect(parseQuietHourStatus(null)).toBeNull();
  });
});
