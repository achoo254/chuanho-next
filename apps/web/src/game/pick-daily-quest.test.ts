import { describe, expect, it } from 'vitest';
import { DAILY_QUESTS } from './daily-quests';
import { dailyQuestIndex, pickDailyQuest } from './pick-daily-quest';

describe('daily quest', () => {
  it('ships forty distinct quests', () => {
    expect(DAILY_QUESTS).toHaveLength(40);
    expect(new Set(DAILY_QUESTS).size).toBe(40);
  });

  it('picks the same quest for the same day', () => {
    expect(pickDailyQuest('2026-11-15', DAILY_QUESTS)).toBe(pickDailyQuest('2026-11-15', DAILY_QUESTS));
  });

  it('changes the quest on the next day, across month and year ends', () => {
    expect(dailyQuestIndex('2026-11-16', 40)).toBe((dailyQuestIndex('2026-11-15', 40) + 1) % 40);
    expect(dailyQuestIndex('2027-01-01', 40)).toBe((dailyQuestIndex('2026-12-31', 40) + 1) % 40);
  });

  it('never leaves the list, for any day and list size', () => {
    for (let day = 1; day <= 28; day += 1) {
      const key = `2026-02-${String(day).padStart(2, '0')}`;
      for (const count of [1, 3, 7, 40]) {
        const index = dailyQuestIndex(key, count);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(count);
      }
    }
    expect(dailyQuestIndex('1969-12-31', 40)).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty list and an unreadable day', () => {
    expect(pickDailyQuest('2026-11-15', [])).toBeUndefined();
    expect(pickDailyQuest('not-a-day', DAILY_QUESTS)).toBe(DAILY_QUESTS[0]);
  });
});
