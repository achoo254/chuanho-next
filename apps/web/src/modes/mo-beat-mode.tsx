/**
 * Mõ Beat in 3D: the same chart, judge and synthesized lofi track as the 2D mode (beat-pattern, rhythm-judge,
 * use-rhythm-song), drawn in the scene: glowing orbs arc onto the wooden fish, which is itself the hit line. A tap
 * anywhere strikes; PERFECT and GOOD rise from the wooden fish, mashing breaks the combo. Combo, score and the peace
 * battery sit in a small HUD; the level pick and the results are compact cards.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_SPECS, type Difficulty, generateBeatChart } from '../game/beat-pattern';
import { useGameSession } from '../game/game-session-context';
import { BATTERY_MAX, type RhythmState, type TapOutcome } from '../game/rhythm-judge';
import { useI18n } from '../i18n/i18n';
import { useRhythmSong } from '../screens/use-rhythm-song';
import { useFloatingText } from '../ui/floating-text';
import { BeatHud } from './beat-hud';
import { type BeatPreview, useBeatPreview } from './beat-preview';
import { ModeBar, MoFloatAnchor, type PlayModeProps, StepDoneCard, StrikeTapLayer, useRegisterStrike } from './mode-chrome';
import { usePlayText } from './play-mode-messages';
import { playStrikeFeedback } from './strike-feedback';

const LEVEL_LABELS = { easy: 'beat.easy', normal: 'beat.normal', hard: 'beat.hard' } as const;

export function MoBeatMode(props: PlayModeProps & { readonly previewSongMs: number | null }): ReactNode {
  const { stage, onBack, onOpen, onSessionComplete, registerStrike, previewSongMs } = props;
  const { t } = useI18n();
  const text = usePlayText();
  const { completeStep, recordCombo } = useGameSession();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const chart = useMemo(() => generateBeatChart(difficulty), [difficulty]);
  const floats = useFloatingText();

  const onFinish = useCallback(
    (final: RhythmState): void => {
      recordCombo(final.bestCombo);
      if (completeStep('beat')) onSessionComplete();
    },
    [recordCombo, completeStep, onSessionComplete],
  );
  const live = useRhythmSong(chart, onFinish);
  const preview: BeatPreview | null = useBeatPreview(chart, previewSongMs);
  const song = preview ?? live;
  const stateRef = useRef(song.state);
  useEffect(() => {
    stateRef.current = song.state;
  }, [song.state]);

  const playing = song.phase === 'playing';
  useEffect(() => {
    stage.setBeatTrack(
      playing ? { notes: chart.notes, songTimeMs: song.songTimeMs, noteState: (index) => stateRef.current.noteStates[index] ?? 'pending' } : null,
      chart.beatMs,
    );
  }, [stage, playing, chart, song.songTimeMs]);
  useEffect(() => () => stage.setBeatTrack(null, 0), [stage]);

  const showOutcome = (outcome: TapOutcome): void => {
    if (outcome.kind === 'mash') {
      floats.spawn(t('beat.mash'), 'miss');
      return;
    }
    floats.spawn(t(`beat.${outcome.grade}`), outcome.grade);
    if (outcome.grade !== 'miss') stage.popNote(outcome.noteIndex);
    if (outcome.grade === 'perfect') stage.flashFace('perfect', 380);
  };

  const strike = (eventTimeMs: number): void => {
    stage.strike();
    playStrikeFeedback();
    if (!playing || preview) return;
    const outcome = live.tap(eventTimeMs);
    if (outcome) showOutcome(outcome);
  };
  useRegisterStrike(registerStrike, strike);

  const { state } = song;
  return (
    <>
      <StrikeTapLayer label={t('beat.tapLabel')} onStrike={strike} dataId="beat-pad" />
      <MoFloatAnchor stage={stage} items={floats.items} />
      <ModeBar onBack={onBack}>{playing && <BeatHud state={state} battery={state.battery / BATTERY_MAX} onQuit={live.stop} />}</ModeBar>

      {song.phase === 'idle' && (
        <div className="play-card" data-id="beat-levels">
          <p className="play-card-title">{t('beat.choose')}</p>
          <div className="level-row" role="radiogroup" aria-label={text('chooseLevel')}>
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
          <p className="play-card-note">{t('beat.howTo')}</p>
          <div className="play-card-actions">
            <button type="button" className="btn-primary" aria-label={text('start')} data-id="beat-start" onClick={live.start}>
              {t('beat.title')}
            </button>
          </div>
        </div>
      )}

      {song.phase === 'finished' && (
        <StepDoneCard title={t('beat.results')} onOpen={onOpen} onBack={onBack}>
          <p className="play-card-line">{t('beat.resultLine', { perfect: state.perfects, good: state.goods, miss: state.misses })}</p>
          <p className="play-card-line">{t('beat.bestCombo', { n: state.bestCombo })}</p>
          <p className="play-card-note">{t('beat.private')}</p>
          <button type="button" className="btn-secondary" data-id="beat-again" onClick={live.start}>
            {t('beat.again')}
          </button>
        </StepDoneCard>
      )}
    </>
  );
}
