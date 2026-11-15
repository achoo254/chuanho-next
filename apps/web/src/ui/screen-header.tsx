/** The title bar of a game screen: a way back to the yard, the title, and an optional control on the right. */
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';

interface ScreenHeaderProps {
  readonly title: string;
  readonly onBack: () => void;
  readonly end?: ReactNode;
}

export function ScreenHeader({ title, onBack, end }: ScreenHeaderProps): ReactNode {
  const { t } = useI18n();
  return (
    <div className="screen-header">
      <button type="button" className="btn-icon" aria-label={t('common.backToYard')} data-id="screen-back" onClick={onBack}>
        <span aria-hidden="true">‹</span>
      </button>
      <h1 className="screen-title">{title}</h1>
      <div className="screen-header-end">{end}</div>
    </div>
  );
}
