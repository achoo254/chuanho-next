/**
 * The radio's controls, each a small piece fed by the radio session: the mode chooser, the player row (play/pause,
 * next track, what is playing), the sleep-timer choices and the focus-rhythm switch. Icons first, few words; every
 * control is a real button at least --tap tall.
 */
import type { ReactNode } from 'react';
import { HudIcon } from '../../hud/hud-icons';
import { RadioIcon } from './radio-icons';
import type { useRadioText } from './radio-messages';
import { RADIO_CHOICES, RADIO_MODES, type RadioChoice, type RadioModeId, type SleepTimerChoice, suggestedRadioMode } from './radio-modes';

type Text = ReturnType<typeof useRadioText>;

export function RadioModeChooser(props: { text: Text; choice: RadioChoice; hour: number; onChoose: (choice: RadioChoice) => void }): ReactNode {
  const { text, choice, hour, onChoose } = props;
  const name = (id: RadioModeId): string => text(`mode.${id}`);
  const autoMode = suggestedRadioMode(hour);
  return (
    <div className="panel-choices radio-modes" role="radiogroup" aria-label={text('modes')}>
      {RADIO_CHOICES.map((each) => {
        const icon = each === 'auto' ? 'auto' : RADIO_MODES[each].icon;
        const label = each === 'auto' ? text('mode.auto') : name(each);
        return (
          <button
            key={each}
            type="button"
            role="radio"
            aria-checked={choice === each}
            aria-label={each === 'auto' ? text('mode.autoLabel', { mode: name(autoMode) }) : undefined}
            className="panel-choice radio-choice"
            data-id={`radio-mode-${each}`}
            onClick={() => onChoose(each)}
          >
            <HudIcon name={icon} size={18} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface PlayerRowProps {
  readonly text: Text;
  readonly paused: boolean;
  readonly trackNumber: number;
  readonly listenedMinutes: number;
  readonly onTogglePlay: () => void;
  readonly onSkip: () => void;
}

export function RadioPlayerRow({ text, paused, trackNumber, listenedMinutes, onTogglePlay, onSkip }: PlayerRowProps): ReactNode {
  return (
    <div className="radio-player">
      <button
        type="button"
        className="radio-play"
        aria-label={paused ? text('play') : text('pause')}
        data-tip={paused ? text('play') : text('pause')}
        data-id="radio-play"
        onClick={onTogglePlay}
      >
        <RadioIcon name={paused ? 'play' : 'pause'} size={28} />
      </button>
      <button type="button" className="hud-btn" aria-label={text('skip')} data-tip={text('skip')} data-id="radio-skip" onClick={onSkip}>
        <RadioIcon name="next" />
      </button>
      <p className="radio-now">
        <span className="panel-line">{text('track', { n: trackNumber })}</span>
        <span className="panel-note">{text('listened', { n: listenedMinutes })}</span>
      </p>
    </div>
  );
}

interface TimerChoicesProps {
  readonly text: Text;
  readonly options: readonly SleepTimerChoice[];
  readonly selected: SleepTimerChoice;
  readonly onPick: (timer: SleepTimerChoice) => void;
}

export function RadioTimerChoices({ text, options, selected, onPick }: TimerChoicesProps): ReactNode {
  return (
    <div className="panel-choices" role="radiogroup" aria-label={text('timers')}>
      <span className="radio-group-icon" aria-hidden="true">
        <RadioIcon name="timer" size={20} />
      </span>
      {options.map((minutes) => (
        <button
          key={minutes ?? 'endless'}
          type="button"
          role="radio"
          aria-checked={selected === minutes}
          aria-label={minutes === null ? text('timer.untilStopLabel') : text('timer.minutesLabel', { n: minutes })}
          className="panel-choice"
          data-id={`radio-timer-${minutes ?? 'endless'}`}
          onClick={() => onPick(minutes)}
        >
          {minutes === null ? text('timer.untilStop') : text('timer.minutes', { n: minutes })}
        </button>
      ))}
    </div>
  );
}

export function RadioFocusSwitch({ text, on, onToggle }: { text: Text; on: boolean; onToggle: () => void }): ReactNode {
  return (
    <div className="radio-focus">
      <button
        type="button"
        className="panel-choice radio-choice"
        aria-pressed={on}
        aria-label={text('focus.toggle')}
        data-id="radio-focus"
        onClick={onToggle}
      >
        <HudIcon name="bell" size={18} />
        <span>25/5</span>
      </button>
      <p className="panel-note">{text('focus.hint')}</p>
    </div>
  );
}
