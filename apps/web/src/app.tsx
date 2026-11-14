import { LanguageSwitch } from '@achoo254/app-shell';
import { type ReactNode, useEffect, useState } from 'react';
import { BRAND_MARK_SRC, ECOSYSTEM_URL, brand } from './brand';
import { useI18n } from './i18n/i18n';
import type { MessageKey } from './i18n/messages';

/** The trust promises shown on the first screen, in this order. */
const PLEDGES: readonly MessageKey[] = [
  'intro.pledge.noAds',
  'intro.pledge.noBegging',
  'intro.pledge.noLuck',
  'intro.pledge.noVirtualGifts',
  'intro.pledge.notTemple',
];

function SiteHeader(): ReactNode {
  const { locale, setLocale } = useI18n();
  return (
    <header className="topbar" data-id="public-header">
      <div className="topbar-inner container">
        <a className="brand" href="/" data-id="public-home">
          <img className="brand-mark" src={BRAND_MARK_SRC} width={36} height={36} alt="" aria-hidden="true" />
          <span className="brand-name">{brand.appName}</span>
        </a>
        {/* The shared language pill: a pick is stored in the cookie every hoandat.com app reads (`hd_lang`). */}
        <LanguageSwitch locale={locale} domain={brand.primaryTenant.domain} onLocaleChange={setLocale} />
      </div>
    </header>
  );
}

function SiteFooter(): ReactNode {
  const { t } = useI18n();
  return (
    <footer className="foot" data-id="public-footer">
      <div className="foot-inner container">
        <a className="foot-home" href={ECOSYSTEM_URL} data-id="foot-home">
          {t('layout.ecosystem', { domain: brand.primaryTenant.domain })}
        </a>
        <p className="foot-note" data-id="foot-note">
          {t('layout.disclaimer')}
        </p>
      </div>
    </footer>
  );
}

/**
 * The first screen: what the app is, its promises, and the Start button. The tap matters beyond navigation:
 * mobile browsers (iOS above all) only let audio play after a user gesture, so the game starts from here.
 */
function IntroPage(): ReactNode {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  return (
    <section className="intro" data-id="intro">
      <h1 className="intro-title">{t('intro.title')}</h1>
      <p className="intro-lead">{t('intro.lead')}</p>
      <ul className="pledges" aria-label={t('intro.pledgeLabel')} data-id="intro-pledges">
        {PLEDGES.map((key) => (
          <li key={key} className="pledge">
            {t(key)}
          </li>
        ))}
      </ul>
      <button type="button" className="btn-start" data-id="intro-start" onClick={() => setStarted(true)}>
        {t('intro.start')}
      </button>
      <p className="intro-status" role="status" data-id="intro-status">
        {started ? t('intro.comingSoon') : ''}
      </p>
    </section>
  );
}

/** Every page: header, the page, footer, over the sunset backdrop. */
export function App(): ReactNode {
  const { t } = useI18n();
  useEffect(() => {
    document.title = `${t('intro.title')} · ${brand.appName}`;
  }, [t]);
  return (
    <div className="site">
      <a className="skip-link" href="#main" data-id="skip-link">
        {t('layout.skip')}
      </a>
      <SiteHeader />
      {/* Focusable by the skip link only, not in the tab order. */}
      <main id="main" tabIndex={-1} className="main container">
        <IntroPage />
      </main>
      <SiteFooter />
    </div>
  );
}
