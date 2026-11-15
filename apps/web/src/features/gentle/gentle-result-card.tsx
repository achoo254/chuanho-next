/**
 * The suggested sentence as a quote card, one at a time: "another one" walks to the next variant, Copy puts the
 * plain text on the clipboard and Share (only where the browser has a share sheet) sends the text alone.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { gentleShareText } from './gentle-logic';
import { useGentleText } from './gentle-messages';
import { canShareText, copyText, shareText } from './gentle-send';

const NOTICE_MS = 2200;

interface GentleResultCardProps {
  readonly sentence: string;
  /** Zero-based position of the sentence among the variants of the current pick. */
  readonly index: number;
  readonly total: number;
  readonly onAnother: () => void;
}

export function GentleResultCard({ sentence, index, total, onAnother }: GentleResultCardProps): ReactNode {
  const t = useGentleText();
  const [notice, setNotice] = useState('');
  const [shareable] = useState(canShareText);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const copy = async (): Promise<void> => {
    setNotice((await copyText(gentleShareText(sentence))) ? t('copied') : t('copyFailed'));
  };

  return (
    <figure className="gentle-quote" data-id="gentle-result">
      <blockquote className="gentle-quote-text" aria-label={t('resultLabel')}>
        {sentence}
      </blockquote>
      <figcaption className="panel-note">{t('counter', { n: index + 1, total })}</figcaption>
      <div className="gentle-actions">
        {total > 1 && (
          <button type="button" className="btn-secondary" onClick={onAnother} data-id="gentle-result-another">
            {t('another')}
          </button>
        )}
        <button type="button" className="btn-primary" onClick={() => void copy()} data-id="gentle-result-copy">
          {t('copy')}
        </button>
        {shareable && (
          <button type="button" className="btn-secondary" onClick={() => void shareText(gentleShareText(sentence))} data-id="gentle-result-share">
            {t('share')}
          </button>
        )}
      </div>
      <p className="panel-note" role="status" aria-live="polite">
        {notice}
      </p>
    </figure>
  );
}
