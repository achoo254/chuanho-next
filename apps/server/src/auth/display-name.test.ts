import { describe, expect, it } from 'vitest';
import { DISPLAY_NAME_MAX, displayNameOf, profileFromUserinfo } from './display-name';

describe('display name', () => {
  it('keeps the given name only (the last word of a Vietnamese name)', () => {
    expect(displayNameOf(' Nguyễn Văn  An ', 'nva')).toBe('An');
    expect(displayNameOf('Linh', undefined)).toBe('Linh');
  });

  it('falls back to the username, and never keeps an email address', () => {
    expect(displayNameOf(undefined, 'van-a')).toBe('van-a');
    expect(displayNameOf('   ', 'van-a')).toBe('van-a');
    expect(displayNameOf('an@example.com', 'van-a')).toBe('van-a');
    expect(displayNameOf('an@example.com', 'an@example.com')).toBeNull();
    expect(displayNameOf(undefined, undefined)).toBeNull();
  });

  it('drops a word too long to show', () => {
    expect(displayNameOf('x'.repeat(DISPLAY_NAME_MAX + 1), 'short')).toBe('short');
    expect(displayNameOf('x'.repeat(DISPLAY_NAME_MAX), null)).toBe('x'.repeat(DISPLAY_NAME_MAX));
  });
});

describe('userinfo profile', () => {
  it('reads the display name of the signed-in account and nothing else', () => {
    expect(profileFromUserinfo({ sub: 's1', name: 'Trần Thị Mai', email: 'mai@example.com', picture: 'https://x.example/p' }, 's1')).toEqual({
      displayName: 'Mai',
    });
    expect(profileFromUserinfo({ sub: 's1' }, 's1')).toEqual({ displayName: null });
  });

  it('ignores an answer about another account or not an object', () => {
    expect(profileFromUserinfo({ sub: 'other', name: 'B' }, 's1')).toBeNull();
    expect(profileFromUserinfo({ name: 'B' }, 's1')).toBeNull();
    expect(profileFromUserinfo(null, 's1')).toBeNull();
    expect(profileFromUserinfo('s1', 's1')).toBeNull();
  });
});
