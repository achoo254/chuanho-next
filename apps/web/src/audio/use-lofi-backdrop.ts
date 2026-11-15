/**
 * Background music while `enabled` is true (chanting, endless mode, and any screen that wants the calm backdrop):
 * the AI music library from the server, shuffled with no repeat within four hours of listening, or the bundled pad
 * loop when the library cannot be reached. See audio/background-music.ts.
 */
import { useEffect } from 'react';
import { acquireBackgroundMusic } from './background-music';

export function useLofiBackdrop(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    return acquireBackgroundMusic();
  }, [enabled]);
}
