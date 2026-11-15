/**
 * The last seven days as a row of little plants: each check-in grows a leaf on that day's stem, each released cloud
 * opens a flower on top, and an empty day is a small sprout. Nothing is red, nothing is a streak to lose.
 */
import { type JournalEntry, countByDay, isReleased } from '@chuanho/contract';
import { type ReactNode, useMemo } from 'react';
import { localDateKey } from '../../game/session-day';
import { shortDayLabel } from './journal-logic';
import { FlowerShape, LeafShape } from './journal-icons';
import { useJournalText } from './journal-messages';

const DAYS = 7;
/** Beyond these the plant stops growing (the label still tells the real number). */
const MAX_LEAVES = 5;
const MAX_FLOWERS = 3;
const GROUND = 70;
const LEAF_GAP = 9;

interface DayPlant {
  readonly day: string;
  readonly count: number;
  readonly released: number;
}

/** One day's plant, drawn in a 30 × 74 box. */
function Plant({ count, released }: { readonly count: number; readonly released: number }): ReactNode {
  const leaves = Math.min(count, MAX_LEAVES);
  const flowers = Math.min(released, MAX_FLOWERS);
  if (leaves === 0) {
    return (
      <g>
        <path className="journal-stem" d={`M15 ${GROUND}v-6`} />
        <LeafShape x={15} y={GROUND - 4} side={-1} />
        <LeafShape x={15} y={GROUND - 6} side={1} />
      </g>
    );
  }
  const top = GROUND - 8 - leaves * LEAF_GAP;
  return (
    <g>
      <path className="journal-stem" d={`M15 ${GROUND}V${top}`} />
      {Array.from({ length: leaves }, (_, i) => (
        <LeafShape key={i} x={15} y={GROUND - 6 - i * LEAF_GAP} side={i % 2 === 0 ? -1 : 1} />
      ))}
      {Array.from({ length: flowers }, (_, i) => (
        <FlowerShape key={i} x={15 + (i - (flowers - 1) / 2) * 9} y={top - 3 - (i % 2) * 3} r={3} />
      ))}
    </g>
  );
}

export function JournalWeekChart({ entries }: { readonly entries: readonly JournalEntry[] }): ReactNode {
  const text = useJournalText();
  const plants = useMemo<DayPlant[]>(() => {
    const today = localDateKey(new Date());
    const released = countByDay(entries.filter(isReleased), today, DAYS);
    return countByDay(entries, today, DAYS).map((day, i) => ({ ...day, released: released[i]?.count ?? 0 }));
  }, [entries]);

  return (
    <section className="journal-section" aria-labelledby="journal-week-title" data-id="journal-week">
      <h3 className="panel-line" id="journal-week-title">
        {text('week.title')}
      </h3>
      <ol className="journal-week">
        {plants.map((plant) => {
          const label = shortDayLabel(plant.day);
          return (
            <li key={plant.day} className="journal-week-day">
              <svg viewBox="0 0 30 74" className="journal-week-plant" role="img" aria-label={text('week.day', { day: label, count: plant.count, released: plant.released })}>
                <path className="journal-ground" d={`M2 ${GROUND + 1}h26`} />
                <Plant count={plant.count} released={plant.released} />
              </svg>
              <span className="journal-week-label" aria-hidden="true">
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="panel-note">{text('week.legend')}</p>
    </section>
  );
}
