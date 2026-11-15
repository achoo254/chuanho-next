import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENTLE_GROUPS, apologyOptions, parseGentleBank } from './gentle-bank';
import { auditGentleBank, phraseProblems } from './gentle-bank-rules';

const SHIPPED: unknown = JSON.parse(readFileSync(new URL('../../../public/content/gentle-phrases.json', import.meta.url), 'utf8'));

const tones = (word: string): Record<string, string[]> => ({
  soft: [`${word} nhẹ nhàng một`, `${word} nhẹ nhàng hai`],
  direct: [`${word} thẳng thắn một`, `${word} thẳng thắn hai`],
  funny: [`${word} vui vẻ một`, `${word} vui vẻ hai`],
});
const apologies = { harsh: ['Xin lỗi vì lời nặng.'], lie: ['Xin lỗi vì nói chưa thật.'], gossip: ['Xin lỗi vì đã kể chuyện.'], anger: ['Xin lỗi vì đã nóng.'] };

describe('the shipped gentle phrase bank', () => {
  it('passes every editorial rule', () => {
    const audit = auditGentleBank(SHIPPED);
    expect(audit.problems).toEqual([]);
    expect(audit.situations).toBeGreaterThanOrEqual(40);
    for (const group of GENTLE_GROUPS) expect(audit.perGroup[group]).toBeGreaterThanOrEqual(8);
  });

  it('keeps every situation through the run-time parser', () => {
    const raw = SHIPPED as { situations: unknown[] };
    expect(parseGentleBank(SHIPPED)?.situations).toHaveLength(raw.situations.length);
  });
});

describe('parseGentleBank', () => {
  it('rejects anything that is not a version 1 bank', () => {
    expect(parseGentleBank(null)).toBeNull();
    expect(parseGentleBank('<!doctype html>')).toBeNull();
    expect(parseGentleBank({ version: 2, situations: [], apologies })).toBeNull();
    expect(parseGentleBank({ version: 1, situations: [], apologies })).toBeNull();
  });

  it('drops bad situations and keeps the first of a repeated id', () => {
    const bank = parseGentleBank({
      version: 1,
      situations: [
        { id: 'late-colleague', group: 'work', label: ' Đồng nghiệp trễ việc ', tones: tones('Câu') },
        { id: 'late-colleague', group: 'work', label: 'Trùng id', tones: tones('Khác') },
        { id: 'Bad Id', group: 'work', label: 'Sai id', tones: tones('Câu') },
        { id: 'no-group', group: 'school', label: 'Sai nhóm', tones: tones('Câu') },
        { id: 'missing-tone', group: 'love', label: 'Thiếu giọng', tones: { soft: ['Một câu thôi'], direct: ['Một câu nữa'], funny: [] } },
        { id: 'too-long', group: 'love', label: 'Câu quá dài', tones: { ...tones('Câu'), funny: ['x'.repeat(201)] } },
      ],
      apologies,
    });
    expect(bank?.situations.map((situation) => situation.id)).toEqual(['late-colleague']);
    expect(bank?.situations[0]?.label).toBe('Đồng nghiệp trễ việc');
  });

  it('rejects a bank missing an apology kind', () => {
    const { gossip: _gossip, ...withoutGossip } = apologies;
    expect(parseGentleBank({ version: 1, situations: [{ id: 'ok', group: 'work', label: 'Ổn', tones: tones('Câu') }], apologies: withoutGossip })).toBeNull();
  });
});

describe('apologyOptions', () => {
  const bank = parseGentleBank({
    version: 1,
    situations: [{ id: 'ok', group: 'work', label: 'Ổn', tones: tones('Câu') }],
    apologies: { ...apologies, harsh: ['một', 'hai', 'ba'] },
  });

  it('returns up to `count` options from a varying start, wrapping around', () => {
    if (!bank) throw new Error('fixture bank should parse');
    expect(apologyOptions(bank, 'harsh', 2, 0)).toEqual(['một', 'hai']);
    expect(apologyOptions(bank, 'harsh', 2, 2)).toEqual(['ba', 'một']);
    expect(apologyOptions(bank, 'harsh', 5, -1)).toEqual(['hai', 'ba', 'một']);
    expect(apologyOptions(bank, 'anger', 3, 7)).toEqual(['Xin lỗi vì đã nóng.']);
  });
});

describe('phraseProblems', () => {
  it('accepts an ordinary sentence, including words that fold onto rude spellings', () => {
    expect(phraseProblems('Các bạn lớn rồi, buổi họp nằm mơ cũng thấy.', 'x')).toEqual([]);
  });

  it('flags contacts, rude words, scripture wording and bad lengths', () => {
    expect(phraseProblems('Nhắn mình qua zalo 0912 345 678 nha', 'x')).toHaveLength(1);
    expect(phraseProblems('Xem thêm ở www.example.com nhé bạn', 'x')).toHaveLength(1);
    expect(phraseProblems('Gửi mình qua ten@mail.vn giúp nhé', 'x')).toHaveLength(1);
    expect(phraseProblems('Thôi im mồm đi cho mình nhờ', 'x')).toEqual(['x: rude wording']);
    expect(phraseProblems('Nam mô A Di Đà Phật, bình tĩnh nhé', 'x')).toEqual(['x: scripture or luck wording']);
    expect(phraseProblems('Ngắn', 'x')).toHaveLength(1);
  });
});

describe('auditGentleBank', () => {
  it('reports duplicates, thin tones, short apology lists and repeated ids', () => {
    const audit = auditGentleBank({
      version: 1,
      situations: [
        { id: 'one', group: 'work', label: 'Một', tones: { ...tones('Câu'), funny: ['Câu vui vẻ một'] } },
        { id: 'one', group: 'work', label: 'Một nữa', tones: tones('Khác') },
        { id: 'two', group: 'friends', label: 'Hai', tones: tones('Câu') },
      ],
      apologies,
    });
    expect(audit.problems).toEqual(
      expect.arrayContaining([
        'one.funny: fewer than 2 sentences',
        'one: duplicate id',
        expect.stringMatching(/^two\.soft\[0\]: same sentence as one\.soft\[0\]$/),
        'apologies.harsh: fewer than 6 sentences',
      ]),
    );
  });

  it('refuses a file the parser cannot use', () => {
    expect(auditGentleBank({ version: 1 }).problems).toEqual(['the file is not a usable version 1 bank']);
  });
});
