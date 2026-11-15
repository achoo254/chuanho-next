/**
 * Mõ Beat in 3D: the same chart, judge and synthesized lofi track as the 2D mode (beat-pattern, rhythm-judge,
 * use-rhythm-song), drawn in the scene: AI-drawn lotus and lantern notes arc onto the wooden fish, which wears a
 * glowing halo as the hit line. A tap anywhere strikes; the judgement pops over the wooden fish on its own art, mashing
 * breaks the combo. The combo badge, score and peace battery make the HUD; the level pick and the results are cream
 * cards with AI-drawn lotus art. Every word stays real text; the art only decorates.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLibrarySong } from '../audio/beatmap-library-song-player';
import { buildLibraryChart } from '../game/beat-library-song';
import { type Difficulty, generateBeatChart } from '../game/beat-pattern';
import { useGameSession } from '../game/game-session-context';
import type { RhythmState, TapOutcome } from '../game/rhythm-judge';
import { useI18n } from '../i18n/i18n';
import { useRhythmSong } from '../audio/use-rhythm-song';
import { type BeatSongSource, BeatLevelCard, BeatResults } from './beat-cards';
import { BeatCombo, BeatHud, BeatPulse } from './beat-hud';
import { BeatJudgementAnchor, useBeatJudgement } from './beat-judgement';
import { useBeatLibraryChoice } from './beat-library-choice';
import { type BeatPreview, useBeatPreview } from './beat-preview';
import { ModeBar, type PlayModeProps, StepDoneCard, StrikeTapLayer, useRegisterStrike } from './mode-chrome';
import { playStrikeFeedback } from './strike-feedback';

export function MoBeatMode(props: PlayModeProps & { readonly previewSongMs: number | null }): ReactNode {
  const { stage, onBack, onOpen, onSessionComplete, registerStrike, previewSongMs } = props;
  const { t } = useI18n();
  const { completeStep, recordCombo } = useGameSession();
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [source, setSource] = useState<BeatSongSource>('library');
  const builtInChart = useMemo(() => generateBeatChart(difficulty), [difficulty]);
  const library = useBeatLibraryChoice(previewSongMs === null);
  const librarySong = library.song;
  const libraryChart = useMemo(
    () => (librarySong ? buildLibraryChart(librarySong.beatmap, difficulty, librarySong.durationMs) : null),
    [librarySong, difficulty],
  );
  const judgement = useBeatJudgement();

  const onFinish = useCallback(
    (final: RhythmState): void => {
      recordCombo(final.bestCombo);
      if (completeStep('beat')) onSessionComplete();
    },
    [recordCombo, completeStep, onSessionComplete],
  );
  const { markPlayed, drop } = library;
  const onLibraryFinish = useCallback(
    (final: RhythmState): void => {
      markPlayed();
      onFinish(final);
    },
    [markPlayed, onFinish],
  );
  const builtIn = useRhythmSong(builtInChart, onFinish);
  // A library song that cannot play: the built-in song plays in its place right away (a broken track is left out).
  const startBuiltIn = builtIn.start;
  const onLibraryUnavailable = useCallback(
    (trackFailed: boolean): void => {
      if (trackFailed) drop();
      setSource('builtIn');
      startBuiltIn();
    },
    [drop, startBuiltIn],
  );
  const librarySongPlayer = useLibrarySong(libraryChart, librarySong?.src ?? null, onLibraryFinish, onLibraryUnavailable);

  // The library song is offered once one is ready; the one playing or showing results stays in charge.
  const libraryOffered = libraryChart !== null && previewSongMs === null;
  const libraryActive = librarySongPlayer.phase !== 'idle' || librarySongPlayer.loading;
  const libraryInCharge = libraryActive || (libraryOffered && source === 'library' && builtIn.phase === 'idle');
  const live = libraryInCharge ? librarySongPlayer : builtIn;
  const chart = libraryInCharge && libraryChart ? libraryChart : builtInChart;
  const preview: BeatPreview | null = useBeatPreview(builtInChart, previewSongMs);
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

      {song.phase === 'idle' && (
        <BeatLevelCard
          difficulty={difficulty}
          onPick={setDifficulty}
          onStart={live.start}
          source={libraryOffered ? source : null}
          onSource={setSource}
          loading={librarySongPlayer.loading}
        />
      )}

      {song.phase === 'finished' && (
        <StepDoneCard title={t('beat.results')} onOpen={onOpen} onBack={onBack}>
          <BeatResults state={state} onAgain={live.start} />
        </StepDoneCard>
      )}
    </>
  );
}
