/** Placeholder for the journal and radio tabs, which arrive later. */
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';

export function ComingSoonScreen({ message, dataId }: { message: MessageKey; dataId: string }): ReactNode {
  const { t } = useI18n();
  return (
    <section className="coming-soon" data-id={dataId}>
      <img className="coming-soon-mascot" src="/art/mascot-pray.webp" width={768} height={768} alt="" />
      <h1 className="screen-title">{t('soon.title')}</h1>
      <p className="session-note">{t(message)}</p>
    </section>
  );
}
