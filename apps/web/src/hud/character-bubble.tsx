/**
 * The character's speech bubble: a small cream card with a tail, floating over its head. The line comes from the
 * play stage (what the character is doing); the position follows the head projected on screen every frame, written
 * straight to the element's style so React only renders when the line changes. The card stays clear of the HUD's
 * top row and bottom bar, pops in, and fades out when the line ends. Decorative chatter, so screen readers skip it.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { bubbleKey } from '../autonomy/autonomy-activities';
import type { BubbleLine } from '../autonomy/yard-autonomy-driver';
import type { PlayStage } from '../modes/play-stage';
import './character-bubble.css';
import { useHudText } from './hud-messages';

/** Room kept free for the HUD: the top row of icons and the bottom bar (CSS pixels). */
const TOP_CLEAR = 76;
const BOTTOM_CLEAR = 84;
const SIDE_CLEAR = 10;
/** Gap between the tail's tip and the top of the head. */
const LIFT = 4;
const LEAVE_MS = 200;

interface Shown {
  readonly line: BubbleLine;
  readonly leaving: boolean;
}

export function CharacterBubble({ stage, visible }: { readonly stage: PlayStage; readonly visible: boolean }): ReactNode {
  const text = useHudText();
  const boxRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    let currentId = -1;
    let leaveTimer = 0;
    const tick = (): void => {
      const { line, anchor } = stage.characterBubble();
      const nextId = line && anchor ? line.id : -1;
      if (nextId !== currentId) {
        currentId = nextId;
        window.clearTimeout(leaveTimer);
        if (line && anchor) setShown({ line, leaving: false });
        else {
          setShown((old) => (old ? { ...old, leaving: true } : null));
          leaveTimer = window.setTimeout(() => setShown((old) => (old?.leaving ? null : old)), LEAVE_MS);
        }
      }
      const box = boxRef.current;
      const host = box?.parentElement;
      if (box && host && anchor) {
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        const left = Math.max(SIDE_CLEAR, Math.min(host.clientWidth - SIDE_CLEAR - width, anchor.x - width / 2));
        const top = Math.max(TOP_CLEAR, Math.min(host.clientHeight - BOTTOM_CLEAR - height, anchor.y - height - LIFT));
        box.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
        box.style.setProperty('--tail-x', `${Math.round(Math.max(18, Math.min(width - 18, anchor.x - left)))}px`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(leaveTimer);
      // Hidden (a play mode, the info panel): drop the line so it does not flash back later.
      setShown(null);
    };
  }, [stage, visible]);

  return (
    <div className="char-bubble-layer" aria-hidden="true">
      {visible && shown && (
        <div ref={boxRef} className="char-bubble" data-id="char-bubble" data-state={shown.leaving ? 'out' : 'in'}>
          <p key={shown.line.id} className="char-bubble-card">
            {text(bubbleKey(shown.line.topic, shown.line.index))}
          </p>
        </div>
      )}
    </div>
  );
}
