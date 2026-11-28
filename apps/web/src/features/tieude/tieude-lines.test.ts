import { describe, expect, it } from 'vitest';
import { TIEUDE_LINES, type TieuDeLine, dayPart, eligibleLines, isSilenced, meritToday, parseTieuDeSilence, pickTieuDeLine } from './tieude-lines';
import { TIEUDE_TEXT } from './tieude-messages';

/** A deterministic stand-in for Math.random. */
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

describe('the line bank', () => {
  it('has at least 30 lines, each with words in every language', () => {
    expect(TIEUDE_LINES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(TIEUDE_LINES.map((line) => line.key)).size).toBe(TIEUDE_LINES.length);
    const keys = Object.keys(TIEUDE_TEXT.vi).filter((key) => key.startsWith('line.'));
    expect(keys.sort()).toEqual(TIEUDE_LINES.map((line) => line.key).sort());
    for (const line of TIEUDE_LINES) {
      expect(TIEUDE_TEXT.vi[line.key].length).toBeGreaterThan(10);
      expect(TIEUDE_TEXT.en[line.key].length).toBeGreaterThan(10);
      expect(TIEUDE_TEXT['zh-CN'][line.key].length).toBeGreaterThan(5);
      expect(TIEUDE_TEXT.vi[line.key].length).toBeLessThanOrEqual(110);
    }
  });

  it('never asks for money, donations, sharing or streaks', () => {
    const banned = /tiền|ủng hộ|donate|chuyển khoản|mua|bán|chia sẻ|share|streak|chuỗi ngày|money|buy|purchase|\bpay/i;
    for (const line of TIEUDE_LINES) {
      expect(TIEUDE_TEXT.vi[line.key]).not.toMatch(banned);
      expect(TIEUDE_TEXT.en[line.key]).not.toMatch(banned);
      expect(TIEUDE_TEXT['zh-CN'][line.key]).not.toMatch(/钱|捐|转账|买|卖|分享|连续打卡/);
    }
  });

  it('only mentions merit in lines marked for it', () => {
    for (const line of TIEUDE_LINES) {
      expect(TIEUDE_TEXT.vi[line.key].includes('{merit}')).toBe(line.merit === true);
      expect(TIEUDE_TEXT.en[line.key].includes('{merit}')).toBe(line.merit === true);
      expect(TIEUDE_TEXT['zh-CN'][line.key].includes('{merit}')).toBe(line.merit === true);
    }
  });

  it('has lines for the morning, the evening and the night', () => {
    for (const part of ['morning', 'evening', 'night'] as const) expect(TIEUDE_LINES.filter((line) => line.part === part).length).toBeGreaterThanOrEqual(2);
  });
});

describe('dayPart', () => {
  it('cuts the local day into four parts', () => {
    expect(dayPart(6)).toBe('morning');
    expect(dayPart(10)).toBe('morning');
    expect(dayPart(13)).toBe('day');
    expect(dayPart(18)).toBe('evening');
    expect(dayPart(22)).toBe('night');
    expect(dayPart(3)).toBe('night');
  });
});

describe('pickTieuDeLine', () => {
  it('never says the same line twice in a row', () => {
    const random = sequence(7);
    let last: TieuDeLine['key'] | null = null;
    for (let i = 0; i < 500; i++) {
      const line = pickTieuDeLine(TIEUDE_LINES, { hour: i % 24, merit: i % 3, lastKey: last, random });
      expect(line).not.toBeNull();
      expect(line?.key).not.toBe(last);
      last = line?.key ?? null;
    }
  });

  it('keeps time-of-day lines to their part of the day', () => {
    const atNoon = eligibleLines(TIEUDE_LINES, { hour: 13, merit: 5, lastKey: null });
    expect(atNoon.some((line) => line.part !== undefined)).toBe(false);
    const atNight = eligibleLines(TIEUDE_LINES, { hour: 23, merit: 5, lastKey: null });
    expect(atNight.filter((line) => line.part !== undefined).every((line) => line.part === 'night')).toBe(true);
    expect(atNight.some((line) => line.part === 'night')).toBe(true);
  });

  it('mentions merit only when there is some', () => {
    expect(eligibleLines(TIEUDE_LINES, { hour: 13, merit: 0, lastKey: null }).some((line) => line.merit)).toBe(false);
    expect(eligibleLines(TIEUDE_LINES, { hour: 13, merit: 1, lastKey: null }).some((line) => line.merit)).toBe(true);
  });

  it('favours the lines of the current part of the day', () => {
    const random = sequence(11);
    let night = 0;
    for (let i = 0; i < 2000; i++) if (pickTieuDeLine(TIEUDE_LINES, { hour: 23, merit: 0, lastKey: null, random })?.part === 'night') night += 1;
    // 3 night lines at weight 4 against 24 everyday lines: about a third, far above the 1 in 9 of an unweighted pick.
    expect(night / 2000).toBeGreaterThan(0.25);
  });

  it('returns null only when nothing can be said', () => {
    expect(pickTieuDeLine([{ key: 'line.water' }], { hour: 12, merit: 0, lastKey: 'line.water', random: () => 0.5 })).toBeNull();
    expect(pickTieuDeLine([{ key: 'line.water' }, { key: 'line.eyes' }], { hour: 12, merit: 0, lastKey: 'line.water', random: () => 0.99 })?.key).toBe('line.eyes');
  });
});

describe('meritToday', () => {
  it('counts the session reward only on the day it was earned', () => {
    expect(meritToday('2026-11-15', '2026-11-15', 10)).toBe(10);
    expect(meritToday('2026-11-14', '2026-11-15', 10)).toBe(0);
    expect(meritToday(null, '2026-11-15', 10)).toBe(0);
  });
});

describe('silence for today', () => {
  it('lasts the rest of the day it was asked on', () => {
    const silence = parseTieuDeSilence({ silencedDay: '2026-11-15' });
    expect(isSilenced(silence, '2026-11-15')).toBe(true);
    expect(isSilenced(silence, '2026-11-16')).toBe(false);
    expect(isSilenced(null, '2026-11-15')).toBe(false);
  });

  it('ignores an unreadable stored value', () => {
    expect(parseTieuDeSilence(null)).toBeNull();
    expect(parseTieuDeSilence({ silencedDay: 'today' })).toBeNull();
  });
});
