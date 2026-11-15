/** The Mõ Beat HUD while a song plays: combo, score, the peace battery, and a stop button. */
import type { ReactNode } from 'react';
import { BATTERY_MAX, type RhythmState } from '../game/rhythm-judge';
import { IconButton } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';

export function BeatHud({ state, battery, onQuit }: { state: RhythmState; battery: number; onQuit: () => void }): ReactNode {
  const { t } = useI18n();
  return (
    <>
      <span className="play-chip" data-id="beat-combo">
        {t('beat.combo', { n: state.combo })}
      </span>
      <span className="play-chip" data-id="beat-score">
        {t('beat.score', { n: state.score })}
      </span>
      <div className="play-battery" role="meter" aria-label={t('beat.battery')} aria-valuemin={0} aria-valuemax={BATTERY_MAX} aria-valuenow={state.battery} data-id="beat-battery">
        <span className="play-battery-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, battery))})` }} />
      </div>
      <IconButton icon="close" label={t('beat.quit')} dataId="beat-quit" onClick={onQuit} />
    </>
  );
}
