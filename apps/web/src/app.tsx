import { LanguageSwitch } from '@achoo254/app-shell';
import { type ReactNode, Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { unlockAudio } from './audio/audio-engine';
import { BRAND_MARK_SRC, ECOSYSTEM_URL, brand } from './brand';
import { GameSessionProvider } from './game/game-session-context';
import { useI18n } from './i18n/i18n';
import { requestTiltPermission } from './scene/use-parallax-tilt';
import { ComingSoonScreen } from './screens/coming-soon-screen';
import type { TempleScreen } from './screens/temple-screens';
import { YardScreen } from './screens/yard-screen';
import { preloadTapFrames } from './tap/use-tap-animation';
import { BottomNav, type Tab } from './ui/bottom-nav';
import { PledgeList } from './ui/pledge-list';

// The heavier screens load when first opened, keeping the first screen's bundle small.
const IncenseScreen = lazy(() => import('./screens/incense-screen').then((m) => ({ default: m.IncenseScreen })));
const MoBeatScreen = lazy(() => import('./screens/mo-beat-screen').then((m) => ({ default: m.MoBeatScreen })));
const MoEndlessScreen = lazy(() => import('./screens/mo-endless-screen').then((m) => ({ default: m.MoEndlessScreen })));
const TungKinhScreen = lazy(() => import('./screens/tung-kinh-screen').then((m) => ({ default: m.TungKinhScreen })));
const SessionEndScreen = lazy(() => import('./screens/session-end-screen').then((m) => ({ default: m.SessionEndScreen })));
const ShareCardScreen = lazy(() => import('./share/share-card-screen').then((m) => ({ default: m.ShareCardScreen })));

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
 * mobile browsers (iOS above all) only allow audio and motion access inside a user gesture, so both start here.
 * It is a click (not pointerdown) because iOS only counts a completed tap as a gesture.
 */
function IntroPage({ onStart }: { onStart: () => void }): ReactNode {
  const { t } = useI18n();
  return (
    <section className="intro" data-id="intro">
      <img className="intro-mascot" src="/art/mascot-mo.webp" width={768} height={768} alt="" />
      <h1 className="intro-title">{t('intro.title')}</h1>
      <p className="intro-lead">{t('intro.lead')}</p>
      <PledgeList dataId="intro-pledges" />
      <button
        type="button"
        className="btn-start"
        data-id="intro-start"
        onClick={() => {
          unlockAudio();
          void requestTiltPermission();
          onStart();
        }}
      >
        {t('intro.start')}
      </button>
      <p className="intro-status">{t('intro.soundHint')}</p>
    </section>
  );
}

/** The temple tab: the yard and the screens it opens. */
function TempleTab(): ReactNode {
  const [screen, setScreen] = useState<TempleScreen>('yard');
  const toYard = useCallback(() => setScreen('yard'), []);
  const toSessionEnd = useCallback(() => setScreen('sessionEnd'), []);
  switch (screen) {
    case 'yard':
      return <YardScreen onOpen={setScreen} />;
    case 'incense':
      return <IncenseScreen onBack={toYard} onSessionComplete={toSessionEnd} />;
    case 'beat':
      return <MoBeatScreen onBack={toYard} onSessionComplete={toSessionEnd} />;
    case 'sutra':
      return <TungKinhScreen onBack={toYard} onSessionComplete={toSessionEnd} />;
    case 'endless':
      return <MoEndlessScreen onBack={toYard} />;
    case 'sessionEnd':
      return <SessionEndScreen onBack={toYard} onShare={() => setScreen('share')} />;
    case 'share':
      return <ShareCardScreen onBack={toYard} />;
  }
}

function GameShell(): ReactNode {
  const [tab, setTab] = useState<Tab>('temple');
  return (
    <div className="game-shell">
      <div className="game-main">
        <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
          {tab === 'temple' && <TempleTab />}
          {tab === 'journal' && <ComingSoonScreen message="soon.journal" dataId="journal-soon" />}
          {tab === 'radio' && <ComingSoonScreen message="soon.radio" dataId="radio-soon" />}
        </Suspense>
      </div>
      <BottomNav current={tab} onSelect={setTab} />
    </div>
  );
}

/** Every page: header, then the intro (with footer) or the game (with the bottom tabs), over the sunset backdrop. */
export function App(): ReactNode {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  useEffect(() => {
    document.title = `${t('intro.title')} · ${brand.appName}`;
  }, [t]);
  useEffect(preloadTapFrames, []);
  return (
    <GameSessionProvider>
      <div className={`site${started ? ' is-playing' : ''}`}>
        <a className="skip-link" href="#main" data-id="skip-link">
          {t('layout.skip')}
        </a>
        <SiteHeader />
        {/* Focusable by the skip link only, not in the tab order. */}
        <main id="main" tabIndex={-1} className={started ? 'main main-game' : 'main container'}>
          {started ? <GameShell /> : <IntroPage onStart={() => setStarted(true)} />}
        </main>
        {!started && <SiteFooter />}
      </div>
    </GameSessionProvider>
  );
}
