/**
 * The judgement of each strike, popping up over the wooden fish wherever the camera has put it: PERFECT on an
 * AI-drawn golden sunburst, GOOD on a lavender cloud, a miss (or mashing) on a small rain cloud. Only the latest
 * judgement shows, like a rhythm game; the word itself stays real text (styled lettering), the art sits behind it.
 * Purely visual, so screen readers skip it (the combo and the results carry the same information).
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { PlayStage } from './play-stage';

export type JudgementKind = 'perfect' | 'good' | 'miss' | 'mash';

interface Judgement {
  readonly id: number;
  readonly kind: JudgementKind;
  readonly text: string;
}

const LIFETIME_MS = 720;
const ART: Readonly<Record<JudgementKind, string>> = {
  perfect: '/art/beat/judge-perfect.webp',
  good: '/art/beat/judge-good.webp',
  miss: '/art/beat/judge-miss.webp',
  mash: '/art/beat/judge-miss.webp',
};

export function useBeatJudgement(): { current: Judgement | null; show: (kind: JudgementKind, text: string) => void } {
  const [current, setCurrent] = useState<Judgement | null>(null);
  const nextId = useRef(0);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const show = useCallback((kind: JudgementKind, text: string): void => {
    nextId.current += 1;
    const id = nextId.current;
    setCurrent({ id, kind, text });
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setCurrent((shown) => (shown?.id === id ? null : shown));
    }, LIFETIME_MS);
  }, []);
  return { current, show };
}

/** Follows the top of the wooden fish on screen every frame and shows the latest judgement above it. */
export function BeatJudgementAnchor({ stage, judgement }: { stage: PlayStage; judgement: Judgement | null }): ReactNode {
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const follow = (): void => {
      const point = stage.moTopOnScreen();
      if (anchor.current && point) anchor.current.style.transform = `translate(${point.x}px, ${point.y}px)`;
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [stage]);
  return (
    <div ref={anchor} className="beat-judge-anchor" aria-hidden="true">
      {judgement && (
        <div key={judgement.id} className={`beat-judge beat-judge-${judgement.kind}`}>
          <img className="beat-judge-art" src={ART[judgement.kind]} alt="" draggable={false} />
          <span className="beat-judge-word">{judgement.text}</span>
        </div>
      )}
    </div>
  );
}
