/** The five trust promises, shown on the first screen and in the yard's About panel. */
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';

const PLEDGES: readonly MessageKey[] = [
  'intro.pledge.noAds',
  'intro.pledge.noBegging',
  'intro.pledge.noLuck',
  'intro.pledge.noVirtualGifts',
  'intro.pledge.notTemple',
];

export function PledgeList({ dataId }: { dataId: string }): ReactNode {
  const { t } = useI18n();
  return (
    <ul className="pledges" aria-label={t('intro.pledgeLabel')} data-id={dataId}>
      {PLEDGES.map((key) => (
        <li key={key} className="pledge">
          {t(key)}
        </li>
      ))}
    </ul>
  );
}
