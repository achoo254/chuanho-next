/** The quick check-in: pick what slipped (four chips), an optional private note, save. */
import { JOURNAL_NOTE_MAX, KARMA_KINDS, type KarmaKind } from '@chuanho/contract';
import { type ReactNode, useState } from 'react';
import { KindIcon } from './journal-icons';
import { useJournalText } from './journal-messages';
import { journalStore } from './journal-store';

export function JournalCheckInForm(): ReactNode {
  const text = useJournalText();
  const [kind, setKind] = useState<KarmaKind | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const save = (): void => {
    if (!kind) return;
    journalStore.add({ kind, note });
    setKind(null);
    setNote('');
    setSaved(true);
  };

  return (
    <form
      className="journal-checkin"
      data-id="journal-checkin"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <fieldset className="journal-fieldset">
        <legend className="panel-line">{text('checkin.title')}</legend>
        <div className="panel-choices">
          {KARMA_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              className="panel-choice journal-kind"
              aria-pressed={kind === option}
              data-id={`journal-kind-${option}`}
              onClick={() => {
                setKind(option);
                setSaved(false);
              }}
            >
              <KindIcon kind={option} size={18} />
              {text(`kind.${option}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="journal-note-label">
        <span className="panel-note">{text('note.label')}</span>
        <textarea
          className="panel-field journal-note"
          rows={2}
          maxLength={JOURNAL_NOTE_MAX}
          placeholder={text('note.placeholder')}
          value={note}
          data-id="journal-note"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="journal-row">
        <button type="submit" className="btn-primary" disabled={!kind} data-id="journal-save">
          {text('save')}
        </button>
        <p className="panel-note" role="status">
          {saved ? text('saved') : ''}
        </p>
      </div>
    </form>
  );
}
