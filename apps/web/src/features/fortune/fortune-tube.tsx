/**
 * The stick tube (ống xăm), drawn in inline SVG: a lacquered tube full of sticks that rattles while shaking and lets
 * one numbered stick rise out at the end. All motion is CSS (fortune.css) keyed on `data-phase`, so reduced motion
 * only needs the stylesheet. Decorative: the panel's status line says what happens.
 */
import type { ReactNode } from 'react';

export type TubePhase = 'idle' | 'shaking' | 'out';

/** The sticks packed in the tube: x position and a small height difference so they do not look printed. */
const STICKS = [
  { x: 40, lift: 4 },
  { x: 47, lift: 0 },
  { x: 54, lift: 6 },
  { x: 61, lift: 2 },
  { x: 68, lift: 5 },
  { x: 75, lift: 1 },
] as const;

interface FortuneTubeProps {
  readonly phase: TubePhase;
  /** One-based number written on the stick that falls out. */
  readonly stickNumber: number | null;
  readonly label: string;
}

export function FortuneTube({ phase, stickNumber, label }: FortuneTubeProps): ReactNode {
  return (
    <div className="fortune-tube" data-phase={phase} data-id="fortune-tube">
      <svg viewBox="0 0 120 160" width="140" height="186" role="img" aria-label={label}>
        <ellipse className="fortune-tube-shadow" cx="60" cy="150" rx="34" ry="6" />
        <g className="fortune-tube-body">
          <g className="fortune-tube-sticks">
            {STICKS.map((stick) => (
              <rect key={stick.x} className="fortune-stick" x={stick.x - 2.5} y={22 - stick.lift} width="5" height="70" rx="2" />
            ))}
          </g>
          <g className="fortune-stick-out">
            <rect className="fortune-stick fortune-stick-chosen" x="55" y="16" width="8" height="78" rx="3" />
            <rect className="fortune-stick-tip" x="55" y="16" width="8" height="12" rx="3" />
            {stickNumber !== null && (
              <text className="fortune-stick-number" x="59" y="58" textAnchor="middle" transform="rotate(-90 59 58)">
                {stickNumber}
              </text>
            )}
          </g>
          <path className="fortune-tube-shell" d="M30 52 h60 l-6 90 a6 6 0 0 1 -6 6 h-36 a6 6 0 0 1 -6 -6 z" />
          <ellipse className="fortune-tube-rim" cx="60" cy="52" rx="30" ry="7" />
          <path className="fortune-tube-band" d="M33 78 h54 l-0.6 9 h-52.8 z" />
          <path className="fortune-tube-band" d="M35.5 118 h49 l-0.6 9 h-47.8 z" />
          <circle className="fortune-tube-seal" cx="60" cy="102" r="9" />
        </g>
      </svg>
    </div>
  );
}
