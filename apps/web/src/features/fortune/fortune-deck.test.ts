import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { QUE_TEXT_MAX, parseQueDeck, queShareText } from './fortune-deck';

const SHIPPED: unknown = JSON.parse(readFileSync(new URL('../../../public/content/que.json', import.meta.url), 'utf8'));

const que = (title: string): Record<string, unknown> => ({ title, verse: ['Câu sáu chữ một hai ba', 'Câu tám chữ một hai ba bốn năm'], meaning: 'Ý nghĩa.', advice: 'Lời nhắn.' });

describe('the shipped quẻ deck', () => {
  it('keeps all 64 quẻ through the parser', () => {
    const deck = parseQueDeck(SHIPPED);
    expect(deck?.que).toHaveLength(64);
    expect(new Set(deck?.que.map((entry) => entry.title)).size).toBe(64);
  });

  it('names its source and carries nothing about the Mệnh palace', () => {
    const raw = SHIPPED as Record<string, unknown>;
    expect(typeof raw.source).toBe('string');
    expect(Object.keys(raw).sort()).toEqual(['que', 'source', 'version']);
    for (const entry of raw.que as Array<Record<string, unknown>>) expect(Object.keys(entry).sort()).toEqual(['advice', 'meaning', 'title', 'verse']);
  });
});

describe('parseQueDeck', () => {
  it('rejects anything that is not a version 1 deck of at least two quẻ', () => {
    expect(parseQueDeck(null)).toBeNull();
    expect(parseQueDeck('<!doctype html>')).toBeNull();
    expect(parseQueDeck({ version: 2, que: [que('Một'), que('Hai')] })).toBeNull();
    expect(parseQueDeck({ version: 1, que: [que('Một')] })).toBeNull();
  });

  it('drops broken entries and trims the text', () => {
    const deck = parseQueDeck({
      version: 1,
      que: [
        { ...que(' Một '), meaning: '  Ý nghĩa.  ' },
        que('Hai'),
        { ...que('Ba'), verse: ['Chỉ một câu'] },
        { ...que('Bốn'), advice: '' },
        { ...que('Năm'), meaning: 'x'.repeat(QUE_TEXT_MAX + 1) },
        { ...que('Sáu'), verse: ['Một', 7] },
      ],
    });
    expect(deck?.que.map((entry) => entry.title)).toEqual(['Một', 'Hai']);
    expect(deck?.que[0]?.meaning).toBe('Ý nghĩa.');
  });
});

describe('queShareText', () => {
  it('holds the quẻ and the footer, nothing else', () => {
    const deck = parseQueDeck({ version: 1, que: [que('Trăng lên'), que('Hai')] });
    const first = deck?.que[0];
    if (!first) throw new Error('fixture deck should parse');
    const text = queShareText(first, 'Cho vui thôi');
    expect(text).toContain('Trăng lên');
    expect(text).toContain('Câu tám chữ một hai ba bốn năm');
    expect(text.endsWith('Cho vui thôi')).toBe(true);
  });
});
