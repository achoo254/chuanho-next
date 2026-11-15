/**
 * The sleep mode's dim screen: it darkens after a while without a touch or key press anywhere on the page (or at
 * once from the dim button) and wakes on a tap. Only a dark layer over the page, never a real screen-off, so the
 * music keeps playing. Modes that do not dim (`afterIdleMs` null) are never dimmed.
 */
import { useCallback, useEffect, useState } from 'react';

export interface IdleDim {
  readonly dimmed: boolean;
  dim(): void;
  wake(): void;
}

export function useIdleDim(afterIdleMs: number | null): IdleDim {
  const [dimmedFlag, setDimmed] = useState(false);
  const dimmed = dimmedFlag && afterIdleMs !== null;

  useEffect(() => {
    if (afterIdleMs === null || dimmed) return;
    let timer = 0;
    const restart = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setDimmed(true), afterIdleMs);
    };
    restart();
    const listeners = new AbortController();
    for (const type of ['pointerdown', 'keydown', 'wheel'] as const) {
      window.addEventListener(type, restart, { signal: listeners.signal, passive: true });
    }
    return () => {
      listeners.abort();
      window.clearTimeout(timer);
    };
  }, [afterIdleMs, dimmed]);

  const dim = useCallback(() => setDimmed(true), []);
  const wake = useCallback(() => setDimmed(false), []);
  return { dimmed, dim, wake };
}
