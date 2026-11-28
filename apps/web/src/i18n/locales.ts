/**
 * The app's languages: the three of the shared shell (`@achoo254/app-shell`), in the order of its language switch.
 * Pure (no React), so the account client and node tests can use it.
 */
export const LOCALES = ['vi', 'en', 'zh-CN'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale => LOCALES.some((locale) => locale === value);

/** The `Intl` locale for dates and times shown in each language. */
export const INTL_LOCALES: Readonly<Record<Locale, string>> = { vi: 'vi-VN', en: 'en-GB', 'zh-CN': 'zh-CN' };
