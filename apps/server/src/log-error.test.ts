import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { safeErrorText } from './log-error';

describe('error text for the journal', () => {
  it('drops the parameters of a failed query', () => {
    const cause = Object.assign(new Error('relation "journal_entries" does not exist'), { code: '42P01' });
    const error = new DrizzleQueryError('insert into "journal_entries" ("note") values ($1)', ['lỡ lời với mẹ'], cause);
    expect(error.message).toContain('lỡ lời với mẹ');
    const text = safeErrorText(error);
    expect(text).toBe('query failed: Error 42P01 relation "journal_entries" does not exist');
    expect(text).not.toContain('lỡ lời');
  });

  it('keeps name and message of other errors', () => {
    expect(safeErrorText(new TypeError('x is not a function'))).toBe('TypeError: x is not a function');
    expect(safeErrorText('weird')).toBe('string');
  });
});
