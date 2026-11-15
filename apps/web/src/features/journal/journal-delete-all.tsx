/**
 * "Xóa hết sổ" with a two-step confirm inside the panel (no browser dialog): the first press asks, the second
 * deletes every entry. Focus moves to the "keep" button when asking, so a stray Enter keeps the journal.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useJournalText } from './journal-messages';
import { journalStore } from './journal-store';

export function JournalDeleteAll({ hasEntries }: { readonly hasEntries: boolean }): ReactNode {
  const text = useJournalText();
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (asking) keepRef.current?.focus();
  }, [asking]);

  if (!asking) {
    return (
      <div className="journal-row" data-id="journal-delete-all">
        <button
          type="button"
          className="btn-chip"
          disabled={!hasEntries}
          data-id="journal-delete-all-start"
          onClick={() => {
            setDone(false);
            setAsking(true);
          }}
        >
          {text('deleteAll.button')}
        </button>
        <p className="panel-note" role="status">
          {done ? text('deleteAll.done') : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="journal-confirm" role="alertdialog" aria-labelledby="journal-delete-all-question" data-id="journal-delete-all">
      <p className="panel-line" id="journal-delete-all-question">
        {text('deleteAll.confirm')}
      </p>
      <div className="journal-row">
        <button ref={keepRef} type="button" className="btn-secondary" data-id="journal-delete-all-keep" onClick={() => setAsking(false)}>
          {text('deleteAll.no')}
        </button>
        <button
          type="button"
          className="btn-secondary journal-danger"
          data-id="journal-delete-all-confirm"
          onClick={() => {
            journalStore.removeAll();
            setAsking(false);
            setDone(true);
          }}
        >
          {text('deleteAll.yes')}
        </button>
      </div>
    </div>
  );
}
