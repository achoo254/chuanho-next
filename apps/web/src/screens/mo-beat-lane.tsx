/**
 * The falling notes of the rhythm mode: small wooden bells sliding down to a gold hit line. Positions are written
 * straight to the DOM every animation frame from the song clock (no React render per frame); judged notes fade out.
 */
import { type ReactNode, useEffect, useRef } from 'react';
import type { NoteState } from '../game/rhythm-judge';

/** How long a note takes to fall from the top of the lane to the hit line. */
const FALL_MS = 1700;
/** Where the hit line sits, as a share of the lane height from the top. */
export const HIT_LINE_RATIO = 0.82;

interface MoBeatLaneProps {
  readonly notes: readonly number[];
  readonly noteStates: readonly NoteState[];
  readonly songTimeMs: () => number | null;
  readonly running: boolean;
}

export function MoBeatLane({ notes, noteStates, songTimeMs, running }: MoBeatLaneProps): ReactNode {
  const laneRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const draw = (): void => {
      const lane = laneRef.current;
      const now = songTimeMs();
      if (lane && now !== null) {
        const hitY = lane.clientHeight * HIT_LINE_RATIO;
        notes.forEach((noteMs, index) => {
          const el = noteRefs.current[index];
          if (!el) return;
          const ahead = noteMs - now;
          const visible = ahead < FALL_MS && ahead > -400;
          el.style.visibility = visible ? 'visible' : 'hidden';
          if (visible) el.style.transform = `translate(-50%, ${hitY - (ahead / FALL_MS) * hitY}px) translateY(-50%)`;
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [notes, songTimeMs, running]);

  return (
    <div ref={laneRef} className="beat-lane" aria-hidden="true">
      <span className="beat-hit-line" style={{ top: `${HIT_LINE_RATIO * 100}%` }} />
      {notes.map((noteMs, index) => (
        <span
          key={noteMs}
          ref={(el) => {
            noteRefs.current[index] = el;
          }}
          className={`beat-note note-${noteStates[index] ?? 'pending'}`}
        >
          <img src="/art/mo.webp" alt="" draggable={false} />
        </span>
      ))}
    </div>
  );
}
