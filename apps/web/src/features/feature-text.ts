/**
 * A feature's own words (Vietnamese and English) behind one hook, so a feature ships its text beside its code
 * instead of growing the main dictionary: `const useJournalText = createFeatureText(vi, en)` where `en` must have
 * the same keys as `vi`, checked by the compiler. The returned function fills `{name}` placeholders (and `{app}`).
 */
import { useCallback } from 'react';
import { format, useI18n } from '../i18n/i18n';

export type FeatureText<K extends string> = (key: K, vars?: Record<string, string | number>) => string;

export function createFeatureText<K extends string>(vi: Readonly<Record<K, string>>, en: Readonly<Record<K, string>>): () => FeatureText<K> {
  return function useFeatureText(): FeatureText<K> {
    const { locale } = useI18n();
    return useCallback((key, vars) => format(locale === 'en' ? en[key] : vi[key], vars), [locale]);
  };
}
