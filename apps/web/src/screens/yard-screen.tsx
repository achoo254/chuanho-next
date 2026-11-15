/**
 * The temple yard: the mascot at the wooden bell (tap to strike, just for the feel), merit and peaceful days, the
 * three steps of today's session, the endless mode, the bell-and-bowl switch and the About panel with the promises.
 */
import { type ReactNode, useCallback } from 'react';
import { buzz, playSample } from '../audio/audio-engine';
import { SESSION_STEPS, type SessionStep, useGameSession } from '../game/game-session-context';
import { localDateKey } from '../game/session-day';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';
import { LayeredScene } from '../scene/layered-scene';
import { TapCharacter } from '../tap/tap-character';
import { useTapAnimation } from '../tap/use-tap-animation';
import { PledgeList } from '../ui/pledge-list';
import type { TempleScreen } from './temple-screens';
import { YardLayers, nextDecoration } from './yard-decorations';

const STEP_LABELS: Record<SessionStep, MessageKey> = { incense: 'yard.step.incense', beat: 'yard.step.beat', sutra: 'yard.step.sutra' };

export function YardScreen({ onOpen }: { onOpen: (screen: TempleScreen) => void }): ReactNode {
  const { t } = useI18n();
  const { progress, steps, updateProgress } = useGameSession();
  const tap = useTapAnimation(
    useCallback(() => {
      playSample('mo');
      buzz(12);
    }, []),
  );
  const rewardedToday = progress.lastRewardedDay === localDateKey(new Date());
  const upcoming = nextDecoration(progress);
  // The first unfinished step glows, incense first.
  const nextStep = SESSION_STEPS.find((step) => !steps[step]);

  return (
    <section className="yard" aria-label={t('yard.heading')} data-id="yard">
      <LayeredScene backdrop="courtyard" layers={<YardLayers progress={progress} />} className="yard-scene" dataId="yard-scene">
        <div className="hud-chips" data-id="yard-stats">
          <span className="chip">{t('yard.merit', { n: progress.merit })}</span>
          <span className="chip">{t('yard.peacefulDays', { n: progress.peacefulDays })}</span>
        </div>
        <TapCharacter animation={tap} label={t('yard.tapLabel')} onTap={tap.strike} className="yard-character" dataId="yard-tap" />
      </LayeredScene>

      <div className="session-card" data-id="yard-session">
        <h2 className="session-title">{t('yard.session')}</h2>
        <ol className="session-steps">
          {SESSION_STEPS.map((step, index) => (
            <li key={step}>
              <button
                type="button"
                className={`step-btn${steps[step] ? ' is-done' : ''}${step === nextStep ? ' is-next' : ''}`}
                data-id={`yard-step-${step}`}
                onClick={() => onOpen(step)}
              >
                <span className="step-index" aria-hidden="true">
                  {steps[step] ? '✓' : index + 1}
                </span>
                <span>{t(STEP_LABELS[step])}</span>
                {steps[step] && <span className="sr-only">{t('yard.stepDone')}</span>}
              </button>
            </li>
          ))}
        </ol>
        <div className="session-row">
          <button type="button" className="btn-secondary" data-id="yard-endless" onClick={() => onOpen('endless')}>
            {t('yard.endless')}
          </button>
          <button
            type="button"
            className="btn-toggle"
            aria-pressed={progress.ambientSounds}
            data-id="yard-ambient"
            onClick={() => updateProgress((current) => ({ ...current, ambientSounds: !current.ambientSounds }))}
          >
            {t('yard.ambient')}: {progress.ambientSounds ? t('common.on') : t('common.off')}
          </button>
        </div>
        <p className="session-note">
          {rewardedToday ? t('yard.rewardedToday') : upcoming ? t('yard.nextDecor', { n: upcoming.missing, item: t(`decor.${upcoming.id}`) }) : ''}
        </p>
        <details className="about" data-id="yard-about">
          <summary>{t('yard.about')}</summary>
          <p>{t('yard.aboutText')}</p>
          <PledgeList dataId="yard-pledges" />
        </details>
      </div>
    </section>
  );
}
