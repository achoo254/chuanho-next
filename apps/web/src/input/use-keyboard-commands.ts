/**
 * Listens for the game's keys on the whole window while `enabled`: Space/Enter strike, 1–3 pick a step, Esc goes
 * back. Keys typed into a control (a focused button, the language pill, a field) keep their usual meaning.
 */
import { useEffect, useRef } from 'react';
import { type KeyCommand, commandForKey } from './keyboard-commands';

function focusIsOnControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('button, a[href], input, select, textarea, summary, [contenteditable="true"], dialog') !== null;
}

/** `onCommand` also gets the key event's time stamp (the rhythm mode judges a strike by when the key went down). */
export function useKeyboardCommands(enabled: boolean, onCommand: (command: KeyCommand, eventTimeMs: number) => void): void {
  const handler = useRef(onCommand);
  useEffect(() => {
    handler.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      const command = commandForKey(event.key, focusIsOnControl(event.target));
      if (!command) return;
      // Space would scroll and Enter would submit; Esc keeps its default so a native dialog still closes.
      if (command.kind === 'action') event.preventDefault();
      // Holding a key down repeats a strike, but not a menu pick.
      if (event.repeat && !(command.kind === 'action' && command.action === 'strike')) return;
      handler.current(command, event.timeStamp);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
