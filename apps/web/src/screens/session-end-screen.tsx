/**
 * The end of a full session: whether merit was counted today, the day's small optional quest, and the way to the
 * share card. No nagging, no streak warnings.
 */
import type { ReactNode } from 'react';
import { DAILY_QUESTS } from '../game/daily-quests';
import { useGameSession } from '../game/game-session-context';
import { pickDailyQuest } from '../game/pick-daily-quest';
import { MERIT_PER_FULL_SESSION } from '../game/player-progress';
import { localDateKey } from '../game/session-day';
import { useI18n } from '../i18n/i18n';
import { ScreenHeader } from '../ui/screen-header';

export function SessionEndScreen({ onBack, onShare }: { onBack: () => void; onShare: () => void }): ReactNode {
  const { t } = useI18n();
  const { lastResult, progress } = useGameSession();
  const day = lastResult?.day ?? localDateKey(new Date());
  const quest = pickDailyQuest(day, DAILY_QUESTS);

  return (
    <section className="game-screen session-end" data-id="session-end">
      <ScreenHeader title={t('end.title')} onBack={onBack} />
      <div className="share-body">
        <img className="session-end-mascot" src="/art/mascot-both.webp" width={768} height={768} alt="" />
        <p className="session-end-result" role="status">
          {lastResult?.rewarded ? t('end.rewarded', { n: MERIT_PER_FULL_SESSION }) : t('end.notRewarded')}
        </p>
        <div className="chips-row">
          <span className="chip">{t('yard.merit', { n: progress.merit })}</span>
          <span className="chip">{t('yard.peacefulDays', { n: progress.peacefulDays })}</span>
        </div>
        {quest && (
          <figure className="quest-card" data-id="session-quest">
            <figcaption className="quest-title">{t('end.quest')}</figcaption>
            <blockquote className="quest-text" lang="vi">
              {quest}
            </blockquote>
          </figure>
        )}
        <div className="level-row">
          <button type="button" className="btn-secondary" data-id="session-end-back" onClick={onBack}>
            {t('common.backToYard')}
          </button>
          <button type="button" className="btn-primary" data-id="session-end-share" onClick={onShare}>
            {t('end.share')}
          </button>
        </div>
      </div>
    </section>
  );
}
