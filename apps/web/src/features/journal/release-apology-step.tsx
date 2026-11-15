/**
 * Release step 2: three gentle apology lines for the entry's kind, from the static gentle-phrase bank, each with a
 * Copy button. The player sends it themself in another app; nothing here sends anything. If the bank cannot load
 * (offline before it was ever cached), a short line says so and the step can still be marked done.
 */
import type { KarmaKind } from '@chuanho/contract';
import { type ReactNode, useEffect, useState } from 'react';
import { type GentleBank, apologyOptions, loadGentleBank } from '../gentle/gentle-bank';
import { useJournalText } from './journal-messages';
import { ReleaseStepFrame } from './release-step-frame';

const OPTION_COUNT = 3;

type CopyState = { readonly index: number; readonly ok: boolean } | null;

/** Copies with the async clipboard API; false when the browser has none or refuses (no permission, not https). */
async function copyText(value: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    console.warn('Clipboard write refused', error);
    return false;
  }
}

interface ApologyStepProps {
  readonly kind: KarmaKind;
  onDone(): void;
  onSkip(): void;
  onClose(): void;
}

export function ReleaseApologyStep({ kind, onDone, onSkip, onClose }: ApologyStepProps): ReactNode {
  const text = useJournalText();
  // undefined while loading, null when the bank is unavailable.
  const [bank, setBank] = useState<GentleBank | null | undefined>(undefined);
  const [seed] = useState(() => Math.floor(Math.random() * 1000));
  const [copied, setCopied] = useState<CopyState>(null);

  useEffect(() => {
    let alive = true;
    void loadGentleBank().then((loaded) => {
      if (alive) setBank(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);

  const options = bank ? apologyOptions(bank, kind, OPTION_COUNT, seed) : [];

  return (
    <ReleaseStepFrame step={2} title={text('apology.title')} doneLabel={text('apology.done')} dataId="release-apology" onDone={onDone} onSkip={onSkip} onClose={onClose}>
      {bank === undefined && <p className="panel-note">{text('apology.loading')}</p>}
      {bank === null && <p className="panel-line">{text('apology.fallback')}</p>}
      {options.length > 0 && (
        <>
          <p className="panel-note">{text('apology.hint')}</p>
          <ul className="panel-list">
            {options.map((line, index) => (
              <li key={line} className="panel-list-item release-apology-line">
                <p className="release-apology-text">{line}</p>
                <button
                  type="button"
                  className="btn-chip"
                  data-id={`release-apology-copy-${index}`}
                  onClick={() => {
                    void copyText(line).then((ok) => setCopied({ index, ok }));
                  }}
                >
                  {copied?.index === index && copied.ok ? text('apology.copied') : text('apology.copy')}
                </button>
              </li>
            ))}
          </ul>
          <p className="panel-note" role="status">
            {copied && !copied.ok ? text('apology.copyFailed') : ''}
          </p>
        </>
      )}
    </ReleaseStepFrame>
  );
}
