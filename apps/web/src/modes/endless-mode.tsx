/**
 * Endless mõ in 3D: strike as much as you like (anywhere on screen, or Space), "+1" rises from the wooden fish, an
 * optional calm auto strike and lofi backdrop, and the wooden fish's skins unlocked by merit as before. Just for
 * fun: it earns no merit.
 */
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useGameSession } from '../game/game-session-context';
import { MO_SKINS, isUnlocked } from '../game/player-progress';
import { HudIcon, IconButton } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { useLofiBackdrop } from '../screens/use-lofi-backdrop';
import { useFloatingText } from '../ui/floating-text';
import { ModeBar, MoFloatAnchor, type PlayModeProps, StrikeTapLayer, useRegisterStrike } from './mode-chrome';
import { playStrikeFeedback } from './strike-feedback';

/** Auto strike pace: a calm 75 strikes a minute (as in the 2D mode). */
const AUTO_STRIKE_MS = 800;

export function EndlessMode({ stage, onBack, registerStrike }: PlayModeProps): ReactNode {
  const { t } = useI18n();
  const { progress, updateProgress } = useGameSession();
  const [count, setCount] = useState(0);
  const [auto, setAuto] = useState(false);
  const [lofi, setLofi] = useState(false);
  const floats = useFloatingText();
  const { spawn } = floats;
  useLofiBackdrop(lofi);

  const strike = useCallback((): void => {
    stage.strike();
    playStrikeFeedback(10);
    setCount((n) => n + 1);
    spawn('+1', 'plain');
  }, [stage, spawn]);
  useRegisterStrike(registerStrike, strike);

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(strike, AUTO_STRIKE_MS);
    return () => window.clearInterval(timer);
  }, [auto, strike]);

  return (
    <>
      <StrikeTapLayer label={t('endless.tapLabel')} onStrike={strike} dataId="endless-pad" />
      <MoFloatAnchor stage={stage} items={floats.items} />
      <ModeBar onBack={onBack}>
        <span className="play-chip" data-id="endless-count">
          {t('endless.count', { n: count })}
        </span>
        <IconButton icon="auto" label={`${t('endless.auto')}: ${auto ? t('common.on') : t('common.off')}`} pressed={auto} dataId="endless-auto" onClick={() => setAuto((v) => !v)} />
        <IconButton icon={lofi ? 'soundOn' : 'soundOff'} label={`${t('endless.lofi')}: ${lofi ? t('common.on') : t('common.off')}`} pressed={lofi} dataId="endless-lofi" onClick={() => setLofi((v) => !v)} />
      </ModeBar>
      <fieldset className="play-skins" data-id="endless-skins">
        <legend className="sr-only">{t('endless.skins')}</legend>
        {MO_SKINS.map((option) => {
          const unlocked = isUnlocked(option, progress);
          const label = unlocked ? t(`endless.skin.${option.id}`) : `${t(`endless.skin.${option.id}`)}: ${t('endless.skinLocked', { n: option.merit })}`;
          return (
            <button
              key={option.id}
              type="button"
              className={`play-skin play-skin-${option.id}`}
              aria-pressed={option.id === progress.moSkin}
              aria-label={label}
              data-tip={label}
              disabled={!unlocked}
              data-id={`endless-skin-${option.id}`}
              onClick={() => updateProgress((current) => ({ ...current, moSkin: option.id }))}
            >
              {unlocked ? <span className="play-skin-swatch" aria-hidden="true" /> : <HudIcon name="lock" size={16} />}
            </button>
          );
        })}
      </fieldset>
    </>
  );
}
