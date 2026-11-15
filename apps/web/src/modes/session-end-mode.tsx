/**
 * The end of a full session in 3D: the character cheers, a compact card says whether merit was counted today (one
 * rewarded session a day, no penalty for skipped days), shows merit and peaceful days, the day's small optional
 * quest, and the way to the share card. Unlocked decorations appear as real objects in the yard behind it.
 */
import type { ReactNode } from 'react';
import { DAILY_QUESTS } from '../game/daily-quests';
import { useGameSession } from '../game/game-session-context';
import { pickDailyQuest } from '../game/pick-daily-quest';
import { MERIT_PER_FULL_SESSION } from '../game/player-progress';
import { localDateKey } from '../game/session-day';
import { HudIcon } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { ModeBar } from './mode-chrome';

export function SessionEndMode({ onBack, onShare }: { onBack: () => void; onShare: () => void }): ReactNode {
  const { t } = useI18n();
  const { lastResult, progress } = useGameSession();
  const quest = pickDailyQuest(lastResult?.day ?? localDateKey(new Date()), DAILY_QUESTS);
  return (
    <>
      <ModeBar onBack={onBack} />
      <div className="play-card play-end" data-id="session-end">
        <p className="play-card-title">{t('end.title')}</p>
        <p className="play-card-line" role="status">
          {lastResult?.rewarded ? t('end.rewarded', { n: MERIT_PER_FULL_SESSION }) : t('end.notRewarded')}
        </p>
        <div className="play-card-chips">
          <span className="play-chip">
            <HudIcon name="merit" size={16} />
            {t('yard.merit', { n: progress.merit })}
          </span>
          <span className="play-chip">{t('yard.peacefulDays', { n: progress.peacefulDays })}</span>
        </div>
        {quest && (
          <figure className="play-quest" data-id="session-quest">
            <figcaption className="play-quest-title">{t('end.quest')}</figcaption>
            <blockquote className="play-quest-text" lang="vi">
              {quest}
            </blockquote>
          </figure>
        )}
        <div className="play-card-actions">
          <button type="button" className="btn-secondary" data-id="session-end-back" onClick={onBack}>
            {t('common.backToYard')}
          </button>
          <button type="button" className="btn-primary play-btn-icon" data-id="session-end-share" onClick={onShare}>
            <HudIcon name="share" size={20} />
            {t('end.share')}
          </button>
        </div>
      </div>
    </>
  );
}
