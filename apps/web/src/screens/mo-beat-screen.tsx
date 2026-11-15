/**
 * Mõ Beat: pick a level, then strike the wooden bell as each falling note meets the gold line, over a synthesized
 * lofi track whose beat the notes follow. PERFECT or GOOD builds the combo and the peace battery; a tap near no note
 * (mashing) breaks the combo and earns nothing. The score is private: no leaderboard anywhere.
 */
import { type CSSProperties, type ReactNode, useCallback, useMemo, useState } from 'react';
import { buzz, playSample } from '../audio/audio-engine';
import { DIFFICULTIES, DIFFICULTY_SPECS, type Difficulty, generateBeatChart } from '../game/beat-pattern';
import { useGameSession } from '../game/game-session-context';
import { BATTERY_MAX, type RhythmState } from '../game/rhythm-judge';
import { useI18n } from '../i18n/i18n';
import type { MessageKey } from '../i18n/messages';
import { LayeredScene } from '../scene/layered-scene';
import { TapCharacter } from '../tap/tap-character';
import { useTapAnimation } from '../tap/use-tap-animation';
import { FloatingTextLayer, useFloatingText } from '../ui/floating-text';
import { ScreenHeader } from '../ui/screen-header';
import { MoBeatLane } from './mo-beat-lane';
import { useRhythmSong } from './use-rhythm-song';

const LEVEL_LABELS: Record<Difficulty, MessageKey> = { easy: 'beat.easy', normal: 'beat.normal', hard: 'beat.hard' };

interface MoBeatScreenProps {
  readonly onBack: () => void;
  readonly onSessionComplete: () => void;
}

export function MoBeatScreen({ onBack, onSessionComplete }: MoBeatScreenProps): ReactNode {
  const { t } = useI18n();
  const { completeStep, recordCombo } = useGameSession();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [sessionDone, setSessionDone] = useState(false);
  const chart = useMemo(() => generateBeatChart(difficulty), [difficulty]);
  const floats = useFloatingText();
  const tapAnim = useTapAnimation(
    useCallback(() => {
      playSample('mo');
      buzz(12);
    }, []),
  );

  const onFinish = useCallback(
    (final: RhythmState): void => {
      recordCombo(final.bestCombo);
      if (completeStep('beat')) setSessionDone(true);
    },
    [recordCombo, completeStep],
  );
  const song = useRhythmSong(chart, onFinish);

  const onTap = (eventTimeMs: number): void => {
    tapAnim.strike();
    if (song.phase !== 'playing') return;
    const outcome = song.tap(eventTimeMs);
    if (!outcome) return;
    if (outcome.kind === 'mash') floats.spawn(t('beat.mash'), 'miss');
    else floats.spawn(t(`beat.${outcome.grade}`), outcome.grade);
  };

  const { state } = song;
  // The "get ready" label fades out by CSS just before the first note (lead-in plus count-in bar).
  const countInStyle = { '--countin-ms': `${Math.max(0, (chart.notes[0] ?? 0) - chart.beatMs / 2 + 400)}ms` } as CSSProperties;

  return (
    <section className="game-screen" data-id="beat">
      <ScreenHeader
        title={t('beat.title')}
        onBack={onBack}
        end={
          song.phase === 'playing' ? (
            <button type="button" className="btn-chip" data-id="beat-quit" onClick={song.stop}>
              {t('beat.quit')}
            </button>
          ) : undefined
        }
      />
      <LayeredScene backdrop="courtyard" className="beat-scene" dataId="beat-scene">
        <div className="beat-hud" data-id="beat-hud">
          <span className="chip">{t('beat.combo', { n: state.combo })}</span>
          <span className="chip">{t('beat.score', { n: state.score })}</span>
          <div className="battery" role="meter" aria-label={t('beat.battery')} aria-valuemin={0} aria-valuemax={BATTERY_MAX} aria-valuenow={state.battery}>
            <span className="battery-label">{t('beat.battery')}</span>
            <span className="battery-track">
              <span className="battery-fill" style={{ width: `${(state.battery / BATTERY_MAX) * 100}%` }} />
            </span>
          </div>
        </div>

        <MoBeatLane notes={chart.notes} noteStates={state.noteStates} songTimeMs={song.songTimeMs} running={song.phase === 'playing'} />
        {song.phase === 'playing' && (
          <p className="beat-countin" style={countInStyle} aria-hidden="true">
            {t('beat.countIn')}
          </p>
        )}

        <TapCharacter animation={tapAnim} label={t('beat.tapLabel')} onTap={onTap} className="beat-character" dataId="beat-tap">
          <FloatingTextLayer items={floats.items} />
        </TapCharacter>

        {song.phase === 'idle' && (
          <div className="overlay-card" data-id="beat-levels">
            <h2 className="overlay-title">{t('beat.choose')}</h2>
            <div className="level-row" role="radiogroup" aria-label={t('beat.choose')}>
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={level === difficulty}
                  className="level-btn"
                  data-id={`beat-level-${level}`}
                  onClick={() => setDifficulty(level)}
                >
                  <span>{t(LEVEL_LABELS[level])}</span>
                  <small>{t('beat.bpm', { bpm: DIFFICULTY_SPECS[level].bpm })}</small>
                </button>
              ))}
            </div>
            <p className="overlay-note">{t('beat.howTo')}</p>
            <button type="button" className="btn-primary" data-id="beat-start" onClick={song.start}>
              {t('beat.title')}
            </button>
          </div>
        )}

        {song.phase === 'finished' && (
          <div className="overlay-card" role="status" data-id="beat-results">
            <h2 className="overlay-title">{t('beat.results')}</h2>
            <p>{t('beat.resultLine', { perfect: state.perfects, good: state.goods, miss: state.misses })}</p>
            <p>{t('beat.bestCombo', { n: state.bestCombo })}</p>
            <p className="overlay-note">{t('beat.private')}</p>
            <div className="level-row">
              <button type="button" className="btn-secondary" data-id="beat-again" onClick={song.start}>
                {t('beat.again')}
              </button>
              <button type="button" className="btn-primary" data-id="beat-done" onClick={sessionDone ? onSessionComplete : onBack}>
                {sessionDone ? t('common.continue') : t('common.backToYard')}
              </button>
            </div>
          </div>
        )}
      </LayeredScene>
    </section>
  );
}
