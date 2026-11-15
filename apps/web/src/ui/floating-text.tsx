/**
 * Short words that pop up and fade (PERFECT, GOOD, +1). A few live at once; each removes itself once its CSS
 * fade has played. Purely visual, so screen readers skip them (results are announced elsewhere).
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

export type FloatTone = 'perfect' | 'good' | 'miss' | 'plain';

interface FloatItem {
  readonly id: number;
  readonly text: string;
  readonly tone: FloatTone;
  /** Small sideways offset (px) so rapid pops do not stack exactly. */
  readonly drift: number;
}

const MAX_ITEMS = 6;
const LIFETIME_MS = 700;

export function useFloatingText(): { items: readonly FloatItem[]; spawn: (text: string, tone: FloatTone) => void } {
  const [items, setItems] = useState<readonly FloatItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const spawn = useCallback((text: string, tone: FloatTone): void => {
    nextId.current += 1;
    const id = nextId.current;
    const drift = ((id * 37) % 41) - 20;
    setItems((current) => [...current.slice(-(MAX_ITEMS - 1)), { id, text, tone, drift }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setItems((current) => current.filter((item) => item.id !== id));
    }, LIFETIME_MS);
    timers.current.add(timer);
  }, []);

  return { items, spawn };
}

export function FloatingTextLayer({ items }: { items: readonly FloatItem[] }): ReactNode {
  return (
    <div className="float-layer" aria-hidden="true">
      {items.map((item) => (
        <span key={item.id} className={`float-text float-${item.tone}`} style={{ translate: `${item.drift}px 0` }}>
          {item.text}
        </span>
      ))}
    </div>
  );
}
