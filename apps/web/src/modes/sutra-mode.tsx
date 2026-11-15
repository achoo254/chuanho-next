/**
 * Chanting in 3D: the camera lowers towards the sutra stand and an AI voice reads the text line by line while a small
 * lower-third strip shows the line being read (word by word) and the next one, so the scene stays in view. Strikes of
 * the wooden fish keep time; without the voice (switched off, muted, or not loaded) each strike lights one word as
 * before. Only the Heart Sutra opening and the public recitation already in sutra-text.ts, never anything else.
 */
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { playSample } from '../audio/audio-engine';
import { useGameSession } from '../game/game-session-context';
import { SUTRA_LINES, SUTRA_WORD_COUNT } from '../game/sutra-text';
import { IconButton } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { useLofiBackdrop } from '../screens/use-lofi-backdrop';
import { ModeBar, type PlayModeProps, StepDoneCard, StrikeTapLayer, useRegisterStrike } from './mode-chrome';
import { usePlayText } from './play-mode-messages';
import { playStrikeFeedback } from './strike-feedback';
import { useSutraVoice } from './sutra-voice-hook';
import { SutraVoicePanel } from './sutra-voice-panel';

export function SutraMode({ stage, onBack, onOpen, onSessionComplete, registerStrike }: PlayModeProps): ReactNode {
  const { t } = useI18n();
  const text = usePlayText();
  const { progress, completeStep } = useGameSession();
  const [lit, setLit] = useState(0);
  const [lofi, setLofi] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const litRef = useRef(0);
  const done = lit >= SUTRA_WORD_COUNT;
  useLofiBackdrop(lofi);

  // Moves the reading to `word` (count of words read); reaching the end finishes the chanting step once.
  const reach = useCallback(
    (word: number): void => {
      const next = Math.min(Math.max(0, word), SUTRA_WORD_COUNT);
      const finished = next >= SUTRA_WORD_COUNT && litRef.current < SUTRA_WORD_COUNT;
      litRef.current = next;
      setLit(next);
      if (!finished) return;
      if (progress.ambientSounds) playSample('bowl', { gain: 0.7 });
      stage.flashFace('happy', 1200);
      if (completeStep('sutra')) onSessionComplete();
    },
    [progress.ambientSounds, stage, completeStep, onSessionComplete],
  );

  const voice = useSutraVoice({ enabled: voiceOn, word: lit, done, onWord: reach });
  const voiceLeads = voice.status === 'playing';

  // While the voice reads, a strike only keeps time; otherwise each strike lights one more word.
  const strike = (): void => {
    stage.strike();
    playStrikeFeedback(10);
    voice.poke();
    if (!voiceLeads && litRef.current < SUTRA_WORD_COUNT) reach(litRef.current + 1);
  };
  useRegisterStrike(registerStrike, strike);

  const voiceLabel = voice.status === 'unavailable' ? text('voiceUnavailable') : `${t('sutra.voice')}: ${voiceOn ? t('common.on') : t('common.off')}`;

  return (
    <>
      {!done && <StrikeTapLayer label={t('sutra.tapLabel')} onStrike={strike} dataId="sutra-pad" />}
      <ModeBar onBack={onBack}>
        <span className="play-chip" aria-label={t('sutra.progress', { n: lit, total: SUTRA_WORD_COUNT })} data-id="sutra-progress">
          {text('wordsLeft', { n: lit, total: SUTRA_WORD_COUNT })}
        </span>
        <IconButton icon="voice" label={voiceLabel} pressed={voiceOn && voice.status !== 'unavailable'} dataId="sutra-voice" onClick={() => setVoiceOn((v) => !v)} />
        <IconButton icon={lofi ? 'soundOn' : 'soundOff'} label={`${t('sutra.lofi')}: ${lofi ? t('common.on') : t('common.off')}`} pressed={lofi} dataId="sutra-lofi" onClick={() => setLofi((v) => !v)} />
      </ModeBar>
      {!done && <SutraVoicePanel lines={SUTRA_LINES} lit={lit} label={`${text('paper')}: ${t('sutra.source')}`} voiceStatus={voice.status} />}
      {done && (
        <StepDoneCard title={t('sutra.done')} onOpen={onOpen} onBack={onBack}>
          <button type="button" className="btn-secondary" data-id="sutra-again" onClick={() => reach(0)}>
            {t('sutra.again')}
          </button>
        </StepDoneCard>
      )}
    </>
  );
}
