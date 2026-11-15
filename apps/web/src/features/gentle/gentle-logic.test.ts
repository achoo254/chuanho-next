import { describe, expect, it } from 'vitest';
import type { GentleBank, GentleSituation } from './gentle-bank';
import { findSituation, firstVariant, gentleShareText, groupSituations, nextVariant } from './gentle-logic';

const situation = (id: string, group: GentleSituation['group']): GentleSituation => ({
  id,
  group,
  label: id,
  tones: { soft: ['a', 'b', 'c'], direct: ['d', 'e'], funny: ['f'] },
});

const bank: GentleBank = {
  situations: [situation('w1', 'work'), situation('l1', 'love'), situation('w2', 'work')],
  apologies: { harsh: ['x'], lie: ['x'], gossip: ['x'], anger: ['x'] },
};

describe('groupSituations', () => {
  it('groups in the fixed group order, keeps file order and skips empty groups', () => {
    expect(groupSituations(bank).map((entry) => [entry.group, entry.situations.map((s) => s.id)])).toEqual([
      ['work', ['w1', 'w2']],
      ['love', ['l1']],
    ]);
  });
});

describe('findSituation', () => {
  it('finds by id and returns null for none or unknown', () => {
    expect(findSituation(bank, 'l1')?.group).toBe('love');
    expect(findSituation(bank, null)).toBeNull();
    expect(findSituation(bank, 'nope')).toBeNull();
  });
});

describe('variant rotation', () => {
  it('starts inside the list for any seed', () => {
    expect(firstVariant(3, 7)).toBe(1);
    expect(firstVariant(3, -4)).toBe(1);
    expect(firstVariant(3, 2.9)).toBe(2);
    expect(firstVariant(0, 5)).toBe(0);
  });

  it('shows every variant once before repeating and never repeats the last shown', () => {
    const count = 3;
    let current = firstVariant(count, 5);
    const shown = [current];
    for (let i = 0; i < count * 2; i += 1) {
      const next = nextVariant(count, current);
      expect(next).not.toBe(current);
      shown.push(next);
      current = next;
    }
    expect(new Set(shown.slice(0, count)).size).toBe(count);
  });

  it('stays on the only variant and is safe on an empty list', () => {
    expect(nextVariant(1, 0)).toBe(0);
    expect(nextVariant(0, 3)).toBe(0);
  });
});

describe('gentleShareText', () => {
  it('is the sentence alone, with whitespace tidied', () => {
    expect(gentleShareText('  Mình xin lỗi\n nha.  ')).toBe('Mình xin lỗi nha.');
  });
});
