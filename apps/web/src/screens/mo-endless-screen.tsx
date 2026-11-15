/**
 * Endless mõ: strike as much as you like, "+1" pops up, optional auto strike and lofi backdrop, and bell skins
 * unlocked by merit (shown in a corner, bouncing on each strike). Just for fun: it earns no merit.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { buzz, playSample } from '../audio/audio-engine';
import { useGameSession } from '../game/game-session-context';
import { MO_SKINS, isUnlocked } from '../game/player-progress';
import { useI18n } from '../i18n/i18n';
import { LayeredScene } from '../scene/layered-scene';
import { TapCharacter } from '../tap/tap-character';
import { replayClass, useTapAnimation } from '../tap/use-tap-animation';
import { FloatingTextLayer, useFloatingText } from '../ui/floating-text';
import { ScreenHeader } from '../ui/screen-header';
import { useLofiBackdrop } from './use-lofi-backdrop';

/** Auto strike pace: a calm 75 strikes a minute. */
const AUTO_STRIKE_MS = 800;

export function MoEndlessScreen({ onBack }: { onBack: () => void }): ReactNode {
  const { t } = useI18n();
  const { progress, updateProgress } = useGameSession();
  const [count, setCount] = useState(0);
  const [auto, setAuto] = useState(false);
  const [lofi, setLofi] = useState(false);
  const skinRef = useRef<HTMLImageElement>(null);
  const floats = useFloatingText();
  useLofiBackdrop(lofi);

  const { spawn } = floats;
  const tap = useTapAnimation(
    useCallback(() => {
      playSample('mo');
      buzz(10);
      setCount((n) => n + 1);
      spawn('+1', 'plain');
      replayClass(skinRef.current, 'is-bounce');
    }, [spawn]),
  );

  const { strike } = tap;
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(strike, AUTO_STRIKE_MS);
    return () => window.clearInterval(timer);
  }, [auto, strike]);

  const skin = MO_SKINS.find((s) => s.id === progress.moSkin) ?? MO_SKINS[0];

  return (
    <section className="game-screen" data-id="endless">
      <ScreenHeader title={t('endless.title')} onBack={onBack} end={<span className="chip">{t('endless.count', { n: count })}</span>} />
      <LayeredScene backdrop="courtyardAlt" className="endless-scene" dataId="endless-scene">
        <img ref={skinRef} className="endless-skin" src={skin.src} alt={t(`endless.skin.${skin.id}`)} />
        <TapCharacter animation={tap} label={t('endless.tapLabel')} onTap={strike} className="endless-character" dataId="endless-tap">
          <FloatingTextLayer items={floats.items} />
        </TapCharacter>
      </LayeredScene>
      <div className="session-card" data-id="endless-controls">
        <div className="session-row">
          <button type="button" className="btn-toggle" aria-pressed={auto} data-id="endless-auto" onClick={() => setAuto((v) => !v)}>
            {t('endless.auto')}: {auto ? t('common.on') : t('common.off')}
          </button>
          <button type="button" className="btn-toggle" aria-pressed={lofi} data-id="endless-lofi" onClick={() => setLofi((v) => !v)}>
            {t('endless.lofi')}: {lofi ? t('common.on') : t('common.off')}
          </button>
        </div>
        <fieldset className="skin-picker" data-id="endless-skins">
          <legend>{t('endless.skins')}</legend>
          {MO_SKINS.map((option) => {
            const unlocked = isUnlocked(option, progress);
            return (
              <button
                key={option.id}
                type="button"
                className="skin-btn"
                aria-pressed={option.id === progress.moSkin}
                disabled={!unlocked}
                data-id={`endless-skin-${option.id}`}
                onClick={() => updateProgress((current) => ({ ...current, moSkin: option.id }))}
              >
                <img src={option.src} alt="" width={48} height={48} />
                <span>{unlocked ? t(`endless.skin.${option.id}`) : t('endless.skinLocked', { n: option.merit })}</span>
              </button>
            );
          })}
        </fieldset>
        <p className="session-note">{t('endless.note')}</p>
      </div>
    </section>
  );
}
