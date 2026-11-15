/**
 * The Mõ Beat HUD while a song plays: the combo on an AI-drawn lotus badge at the top (it bumps on every hit and
 * flares every ten), the score and the peace battery in the corner bar with a stop button, and a soft warm glow at the
 * screen's edges that breathes on every beat.
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { BATTERY_MAX, type RhythmState } from '../game/rhythm-judge';
import { IconButton } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { beatPulse } from './beat-note-motion';

/** The combo badge shows from this many hits in a row. */
const COMBO_SHOWN_FROM = 2;
const COMBO_MILESTONE = 10;

export function BeatHud({ state, onQuit }: { state: RhythmState; onQuit: () => void }): ReactNode {
  const { t } = useI18n();
  const battery = Math.max(0, Math.min(1, state.battery / BATTERY_MAX));
  return (
    <>
      <span className="beat-chip" data-id="beat-score">
        {t('beat.score', { n: state.score })}
      </span>
      <div className="beat-battery" role="meter" aria-label={t('beat.battery')} aria-valuemin={0} aria-valuemax={BATTERY_MAX} aria-valuenow={state.battery} data-id="beat-battery">
        <img className="beat-battery-icon" src="/art/beat/level-easy.webp" alt="" draggable={false} />
        <span className="beat-battery-track">
          <span className="beat-battery-fill" style={{ transform: `scaleX(${battery})` }} />
        </span>
      </div>
      <IconButton icon="close" label={t('beat.quit')} dataId="beat-quit" onClick={onQuit} />
    </>
  );
}

/**
 * The combo as a big number on the lotus badge. The word under it is the combo message with the number left out, so
 * both languages keep their own wording without a second message.
 */
export function BeatCombo({ combo }: { combo: number }): ReactNode {
  const { t } = useI18n();
  if (combo < COMBO_SHOWN_FROM) return null;
  const milestone = combo % COMBO_MILESTONE === 0;
  return (
    <div className={`beat-combo${milestone ? ' is-milestone' : ''}`} role="img" aria-label={t('beat.combo', { n: combo })} data-id="beat-combo">
      <img className="beat-combo-art" src="/art/beat/combo-badge.webp" alt="" draggable={false} />
      <span key={combo} className="beat-combo-n">
        {combo}
      </span>
      <span className="beat-combo-word">{t('beat.combo', { n: '' }).trim()}</span>
    </div>
  );
}

/** A warm glow round the screen's edges that flares on each beat of the song and fades before the next. */
export function BeatPulse({ songTimeMs, beatMs }: { songTimeMs: () => number | null; beatMs: number }): ReactNode {
  const glow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    const tick = (): void => {
      const now = songTimeMs();
      if (glow.current) glow.current.style.opacity = String(now === null ? 0 : beatPulse(now, beatMs) * 0.85);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [songTimeMs, beatMs]);
  return <div ref={glow} className="beat-pulse" aria-hidden="true" />;
}
