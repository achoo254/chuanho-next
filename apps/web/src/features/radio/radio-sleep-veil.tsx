/**
 * The dark layer of the sleep mode: covers the whole screen, shows only a faint line (time left, or "music off"),
 * and wakes on a tap or on Enter/Space (it is one big button that takes focus, so keyboards and screen readers
 * reach it). Focus goes back where it was when the screen wakes.
 */
import { type ReactNode, useEffect, useRef } from 'react';

interface RadioSleepVeilProps {
  /** The accessible name and faint hint ("Tap to wake"). */
  readonly wakeLabel: string;
  /** A faint status line (time left), or null. */
  readonly status: string | null;
  readonly onWake: () => void;
}

export function RadioSleepVeil({ wakeLabel, status, onWake }: RadioSleepVeilProps): ReactNode {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    button.current?.focus({ preventScroll: true });
    return () => before?.focus({ preventScroll: true });
  }, []);
  return (
    <button ref={button} type="button" className="radio-veil" aria-label={wakeLabel} data-id="radio-veil" onClick={onWake}>
      <span className="radio-veil-text" aria-hidden="true">
        {status && <span className="radio-veil-status">{status}</span>}
        <span>{wakeLabel}</span>
      </span>
    </button>
  );
}
