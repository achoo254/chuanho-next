import { type PreferenceEnvironment, writePreference } from '@achoo254/app-shell/preferences';
import { describe, expect, it } from 'vitest';
import { brand } from '../brand';
import { LOCALES, initialLocale, isLocale, storedLocale, translator } from './i18n';
import { en, vi, zhCN } from './messages';

/** A page on the app's own host whose cookie jar is a string, as the shell's preferences see it. */
function fakePage(): PreferenceEnvironment & { cookies: string[] } {
  const cookies: string[] = [];
  return {
    protocol: 'https:',
    hostname: `chuanho.${brand.primaryTenant.domain}`,
    cookies,
    readCookies: () => cookies.map((cookie) => cookie.split(';')[0]).join('; '),
    writeCookie: (cookie) => {
      const name = cookie.split('=')[0];
      const at = cookies.findIndex((stored) => stored.startsWith(`${name}=`));
      if (at >= 0) cookies.splice(at, 1);
      cookies.push(cookie);
    },
    storage: () => undefined,
    memory: new Map(),
  };
}

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();

describe('languages', () => {
  it('speaks the three languages of the shared shell', () => {
    expect(LOCALES).toEqual(['vi', 'en', 'zh-CN']);
    expect(isLocale('zh-CN')).toBe(true);
    expect(isLocale('zh')).toBe(false);
    expect(isLocale('fr')).toBe(false);
  });

  it('shows Simplified Chinese when it is picked', () => {
    expect(translator('zh-CN')('nav.temple')).toBe('寺院');
    expect(translator('zh-CN')('yard.merit', { n: 3 })).toBe('3 功德');
    expect(initialLocale('?lang=zh-CN', undefined)).toBe('zh-CN');
    expect(initialLocale('', 'zh-CN')).toBe('zh-CN');
    expect(initialLocale('?lang=fr', undefined)).toBe('vi');
  });

  it('keeps every placeholder in every translation', () => {
    for (const key of Object.keys(vi) as (keyof typeof vi)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(vi[key]));
      expect(placeholders(zhCN[key]), key).toEqual(placeholders(vi[key]));
      expect(zhCN[key].trim(), key).not.toBe('');
    }
  });

  it('stores 中文 in the shared hd_lang cookie and reads it back', () => {
    const page = fakePage();
    expect(storedLocale(page)).toBeUndefined();
    writePreference('lang', 'zh-CN', { domain: brand.primaryTenant.domain }, page);
    expect(page.cookies.join('\n')).toContain('hd_lang=zh-CN');
    expect(storedLocale(page)).toBe('zh-CN');
  });
});
