/**
 * The radio ("Đài"): the yard's AI music library as a listening screen with two modes from radio-modes.ts. Sleep
 * turns the yard to lantern night, plays gentler night tracks, fades out and stops on a sleep timer, dims the
 * screen after a while and lets the character doze. Work turns it to a misty morning with soft music and an
 * optional 25/5 focus rhythm with a gentle chime at each switch. "By the clock" pre-selects the mode for the hour;
 * the player always chooses. Leaving restores the time of day and hands the music back to the yard unchanged.
 */
import type { ReactNode } from 'react';
import type { PanelProps } from '../panel-registry';
import { PanelFrame } from '../panel-frame';
import { RadioFocusSwitch, RadioModeChooser, RadioPlayerRow, RadioTimerChoices } from './radio-controls';
import { RadioIcon } from './radio-icons';
import { useRadioText } from './radio-messages';
import type { RadioChoice } from './radio-modes';
import { formatCountdown, radioListenedMinutes, radioTrackNumber } from './radio-readouts';
import { RadioSleepVeil } from './radio-sleep-veil';
import { useIdleDim } from './use-idle-dim';
import { useRadioSession } from './use-radio-session';
import './radio.css';

export function RadioPanel({ onBack, lighting, stage }: PanelProps): ReactNode {
  const text = useRadioText();
  const radio = useRadioSession(lighting, stage);
  const { mode, state, timer, asleep, paused, pomodoro } = radio;
  const idle = useIdleDim(mode.dimAfterIdleMs);

  const choose = (choice: RadioChoice): void => {
    idle.wake();
    radio.choose(choice);
  };

  // One short line for the bar chip and the dim screen: the sleep countdown, the focus phase, or "music off".
  let status: string | null = null;
  if (asleep) status = text('timer.done');
  else if (timer && timer.remainingMs !== null) status = text('timer.left', { time: formatCountdown(timer.remainingMs) });
  else if (pomodoro) status = text(pomodoro.phase === 'focus' ? 'focus.focus' : 'focus.break', { time: formatCountdown(pomodoro.remainingMs) });

  const chip = status && (
    <span className="play-chip radio-chip" role="timer" data-id="radio-countdown">
      <RadioIcon name={pomodoro ? 'bell' : 'timer'} size={16} />
      {status}
    </span>
  );

  return (
    <>
      <PanelFrame title={text('title')} onBack={onBack} bar={chip} dataId="radio-panel">
        <RadioModeChooser text={text} choice={state.choice} hour={state.hour} onChoose={choose} />
        <RadioPlayerRow
          text={text}
          paused={paused}
          trackNumber={radioTrackNumber(radio.statsAtOpen, radio.stats)}
          listenedMinutes={radioListenedMinutes(radio.statsAtOpen, radio.stats)}
          onTogglePlay={radio.togglePlay}
          onSkip={radio.skip}
        />
        {mode.sleepTimers.length > 0 && (
          <RadioTimerChoices text={text} options={mode.sleepTimers} selected={state.timerChoice} onPick={radio.pickTimer} />
        )}
        {mode.pomodoro && <RadioFocusSwitch text={text} on={state.pomodoroOn} onToggle={radio.togglePomodoro} />}
        {mode.dimAfterIdleMs !== null && (
          <button type="button" className="panel-choice radio-choice radio-dim" data-id="radio-dim" onClick={idle.dim}>
            <RadioIcon name="dim" size={18} />
            <span>{text('dim')}</span>
          </button>
        )}
      </PanelFrame>
      {idle.dimmed && <RadioSleepVeil wakeLabel={text('wake')} status={status} onWake={idle.wake} />}
    </>
  );
}
