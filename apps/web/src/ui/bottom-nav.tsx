/** The bottom tab bar: the temple (the game), the journal and the radio (both arrive later). */
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';

export const TABS = ['temple', 'journal', 'radio'] as const;
export type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, MessageKey> = { temple: 'nav.temple', journal: 'nav.journal', radio: 'nav.radio' };
/** Line icons (24×24, stroked in the text colour): a curved temple roof, an open book, a radio with sound waves. */
const TAB_ICON_PATHS: Record<Tab, string> = {
  temple: 'M2 10c3 0 5-2 10-6 5 4 7 6 10 6M5 10v10h14V10M10 20v-5h4v5M1 20h22',
  journal: 'M12 6c-2-1.5-5-2-9-2v15c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2zM12 6v15',
  radio: 'M4 9h16v11H4zM8 9l8-5M8 15a2 2 0 1 0 0-.01M14 13h3M14 16h3',
};

function TabIcon({ tab }: { tab: Tab }): ReactNode {
  return (
    <svg className="bottom-nav-icon" viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" focusable="false">
      <path d={TAB_ICON_PATHS[tab]} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BottomNav({ current, onSelect }: { current: Tab; onSelect: (tab: Tab) => void }): ReactNode {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label={t('nav.label')} data-id="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          className="bottom-nav-item"
          aria-current={tab === current ? 'page' : undefined}
          data-id={`nav-${tab}`}
          onClick={() => onSelect(tab)}
        >
          <TabIcon tab={tab} />
          <span>{t(TAB_LABELS[tab])}</span>
        </button>
      ))}
    </nav>
  );
}
