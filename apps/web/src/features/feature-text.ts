/**
 * A feature's own words (Vietnamese, English and Simplified Chinese) behind one hook, so a feature ships its text
 * beside its code instead of growing the main dictionary: `const useJournalText = createFeatureText(vi, en, zhCN)`
 * where `en` and `zhCN` must have the same keys as `vi`, checked by the compiler. The returned function fills
 * `{name}` placeholders (and `{app}`).
 */
import { useCallback } from 'react';
import { type Locale, format, useI18n } from '../i18n/i18n';

export type FeatureText<K extends string> = (key: K, vars?: Record<string, string | number>) => string;

type Words<K extends string> = Readonly<Record<K, string>>;

export function createFeatureText<K extends string>(vi: Words<K>, en: Words<K>, zhCN: Words<K>): () => FeatureText<K> {
  const dictionaries: Readonly<Record<Locale, Words<K>>> = { vi, en, 'zh-CN': zhCN };
  return function useFeatureText(): FeatureText<K> {
    const { locale } = useI18n();
    return useCallback((key, vars) => format(dictionaries[locale][key], vars), [locale]);
  };
}
