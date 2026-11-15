/**
 * The shared burner, drawn inline (SVG, colours from tokens.css only): one stick per member who lit, shrinking as it
 * burns with a glowing tip, smoke that thickens with the sticks still burning, a halo and petals at the collective
 * milestones, and drifting ash once everything is out. Purely visual; the numbers are in the text around it.
 */
import type { ReactNode } from 'react';
import type { MemberView } from './room-view-model';

const SAND_Y = 100;
const STICK_HEIGHT = 70;
const STUB = 5;
const LEFT = 62;
const RIGHT = 138;

interface RoomCenserProps {
  readonly members: readonly MemberView[];
  readonly smoke: number;
  readonly milestone: number;
  readonly ashes: boolean;
  readonly label: string;
}

/** x of the i-th of n sticks, spread over the bowl's opening. */
const stickX = (index: number, count: number): number => (count <= 1 ? 100 : LEFT + ((RIGHT - LEFT) * index) / (count - 1));

export function RoomCenser({ members, smoke, milestone, ashes, label }: RoomCenserProps): ReactNode {
  const lit = members.filter((member) => member.stick !== null);
  return (
    <svg className="room-censer" viewBox="0 0 200 160" role="img" aria-label={label} data-id="room-censer">
      {milestone >= 10 && <circle cx="100" cy="92" r={milestone >= 25 ? 74 : 62} fill="var(--c-ray)" />}
      {milestone >= 25 && <circle cx="100" cy="92" r="52" fill="var(--c-ray-soft)" />}
      {milestone >= 50 &&
        [-60, -30, 0, 30, 60].map((angle) => (
          <ellipse key={angle} cx="100" cy="40" rx="7" ry="16" fill="var(--c-lotus)" transform={`rotate(${angle} 100 104)`} />
        ))}

      {!ashes && smoke > 0 && (
        <g className="room-smoke" style={{ opacity: 0.25 + smoke * 0.75 }}>
          <path d="M92 28 C 82 16, 102 8, 92 2" />
          <path d="M104 26 C 114 14, 96 6, 108 0" />
          {smoke > 0.4 && <path d="M116 30 C 126 18, 108 10, 120 4" />}
          {smoke > 0.7 && <path d="M80 30 C 70 18, 90 10, 78 4" />}
        </g>
      )}

      {lit.map((member, index) => {
        const stick = member.stick;
        if (!stick) return null;
        const x = stickX(index, lit.length);
        const height = stick.burntOut ? STUB : STUB + (STICK_HEIGHT - STUB) * (1 - stick.progress);
        const top = SAND_Y - height;
        return (
          <g key={member.id}>
            <rect x={x - 1.5} y={top} width="3" height={height} rx="1" fill="var(--c-incense-body)" />
            {!stick.burntOut && (
              <>
                <circle className="room-ember-glow" cx={x} cy={top} r="5" fill="var(--c-ember-glow)" />
                <circle cx={x} cy={top} r="2.2" fill="var(--c-ember)" />
                {member.isMe && <circle cx={x} cy={top} r="7.5" fill="none" stroke="var(--c-primary)" strokeWidth="1.2" />}
              </>
            )}
          </g>
        );
      })}

      <ellipse cx="100" cy={SAND_Y} rx="52" ry="9" fill="var(--c-primary-solid)" />
      <ellipse cx="100" cy={SAND_Y} rx="46" ry="6" fill="var(--c-scene-dust)" />
      <path d="M48 101 Q 50 140 100 142 Q 150 140 152 101 Q 100 116 48 101 Z" fill="var(--c-bronze)" />
      <rect x="66" y="138" width="10" height="12" rx="3" fill="var(--c-incense-handle)" />
      <rect x="124" y="138" width="10" height="12" rx="3" fill="var(--c-incense-handle)" />

      {ashes && (
        <g className="room-ash">
          {[78, 92, 104, 116, 126].map((x, index) => (
            <circle key={x} cx={x} cy={SAND_Y - 8 - (index % 3) * 6} r="1.6" fill="var(--c-scene-smoke)" style={{ animationDelay: `${index * 0.4}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}
