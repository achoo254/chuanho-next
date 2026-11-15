/**
 * The recent live entries, each a "karma cloud": the kind, the note, the day, three dots for the release steps, a
 * way into the release flow and a delete button. A released entry shows its cloud dissolved.
 */
import { type JournalEntry, isReleased } from '@chuanho/contract';
import type { ReactNode } from 'react';
import { shortDayLabel } from './journal-logic';
import { KarmaCloud, KindIcon, TrashIcon } from './journal-icons';
import { useJournalText } from './journal-messages';
import { journalStore } from './journal-store';
import { doneStepCount } from './release-steps';

/** How many recent clouds the list shows (the weekly chart still counts every entry). */
const RECENT_LIMIT = 20;

interface CloudListProps {
  /** Live entries, newest first. */
  readonly entries: readonly JournalEntry[];
  onRelease(id: string): void;
}

export function JournalCloudList({ entries, onRelease }: CloudListProps): ReactNode {
  const text = useJournalText();
  return (
    <section className="journal-section" aria-labelledby="journal-list-title" data-id="journal-list">
      <h3 className="panel-line" id="journal-list-title">
        {text('list.title')}
      </h3>
      {entries.length === 0 ? (
        <p className="panel-note">{text('list.empty')}</p>
      ) : (
        <ul className="panel-list">
          {entries.slice(0, RECENT_LIMIT).map((entry) => {
            const released = isReleased(entry);
            const kind = text(`kind.${entry.kind}`);
            const day = shortDayLabel(entry.day);
            const done = doneStepCount(entry);
            return (
              <li key={entry.id} className="panel-list-item journal-entry" data-released={released} data-id={`journal-entry-${entry.id}`}>
                <KarmaCloud dissolved={released} />
                <div className="journal-entry-text">
                  <p className="journal-entry-kind">
                    <KindIcon kind={entry.kind} size={16} />
                    {kind}
                    <span className="journal-entry-day">{day}</span>
                  </p>
                  {entry.note && <p className="journal-entry-note">{entry.note}</p>}
                  <p className="journal-entry-steps">
                    <span className="sr-only">{released ? text('list.released') : text('list.steps', { n: done })}</span>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="journal-step-dot" data-done={i < done} aria-hidden="true" />
                    ))}
                  </p>
                </div>
                <div className="journal-entry-actions">
                  {released ? (
                    <span className="journal-entry-released">{text('list.released')}</span>
                  ) : (
                    <button type="button" className="btn-chip" data-id={`journal-release-${entry.id}`} onClick={() => onRelease(entry.id)}>
                      {text('list.release')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-chip journal-delete"
                    aria-label={text('list.deleteLabel', { kind, day })}
                    title={text('list.delete')}
                    data-id={`journal-delete-${entry.id}`}
                    onClick={() => journalStore.remove(entry.id)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
