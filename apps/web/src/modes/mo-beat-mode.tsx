/**
 * Mõ Beat in 3D: the same chart, judge and synthesized lofi track as the 2D mode (beat-pattern, rhythm-judge,
 * use-rhythm-song), drawn in the scene: AI-drawn lotus and lantern notes arc onto the wooden fish, which wears a
 * glowing halo as the hit line. A tap anywhere strikes; the judgement pops over the wooden fish on its own art, mashing
 * breaks the combo. The combo badge, score and peace battery make the HUD; the level pick and the results are cream
 * cards with AI-drawn lotus art. Every word stays real text; the art only decorates.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Difficulty, generateBeatChart } from '../game/beat-pattern';
import { useGameSession } from '../game/game-session-context';
import type { RhythmState, TapOutcome } from '../game/rhythm-judge';
import { useI18n } from '../i18n/i18n';
import { useRhythmSong } from '../screens/use-rhythm-song';
import { BeatLevelCard, BeatResults } from './beat-cards';
import { BeatCombo, BeatHud, BeatPulse } from './beat-hud';
import { BeatJudgementAnchor, useBeatJudgement } from './beat-judgement';
import { type BeatPreview, useBeatPreview } from './beat-preview';
import { ModeBar, type PlayModeProps, StepDoneCard, StrikeTapLayer, useRegisterStrike } from './mode-chrome';
import { playStrikeFeedback } from './strike-feedback';

export function MoBeatMode(props: PlayModeProps & { readonly previewSongMs: number | null }): ReactNode {
  const { stage, onBack, onOpen, onSessionComplete, registerStrike, previewSongMs } = props;
  const { t } = useI18n();
  const { completeStep, recordCombo } = useGameSession();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const chart = useMemo(() => generateBeatChart(difficulty), [difficulty]);
  const judgement = useBeatJudgement();

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
      playing
        ? { notes: chart.notes, beatMs: chart.beatMs, songTimeMs: song.songTimeMs, noteState: (index) => stateRef.current.noteStates[index] ?? 'pending' }
        : null,
      chart.beatMs,
    );
  }, [stage, playing, chart, song.songTimeMs]);
  useEffect(() => () => stage.setBeatTrack(null, 0), [stage]);

  const showOutcome = (outcome: TapOutcome): void => {
    if (outcome.kind === 'mash') {
      judgement.show('mash', t('beat.mash'));
      return;
    }
    judgement.show(outcome.grade, t(`beat.${outcome.grade}`));
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
      {playing && <BeatPulse songTimeMs={song.songTimeMs} beatMs={chart.beatMs} />}
      <StrikeTapLayer label={t('beat.tapLabel')} onStrike={strike} dataId="beat-pad" />
      <BeatJudgementAnchor stage={stage} judgement={judgement.current} />
      {playing && <BeatCombo combo={state.combo} />}
      <ModeBar onBack={onBack}>{playing && <BeatHud state={state} onQuit={live.stop} />}</ModeBar>

      {song.phase === 'idle' && <BeatLevelCard difficulty={difficulty} onPick={setDifficulty} onStart={live.start} />}

      {song.phase === 'finished' && (
        <StepDoneCard title={t('beat.results')} onOpen={onOpen} onBack={onBack}>
          <BeatResults state={state} onAgain={live.start} />
        </StepDoneCard>
      )}
    </>
  );
}
