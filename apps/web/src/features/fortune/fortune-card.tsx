/**
 * The slip (lá xăm) of the day: the quẻ's name, its two lục bát lines, the meaning in plain words and one small thing
 * to do today, on a paper card. Copy and Share (where the browser has a share sheet) send the text alone, through the
 * same helpers as the gentle-words screen.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { canShareText, copyText, shareText } from '../gentle/gentle-send';
import { type Que, queShareText } from './fortune-deck';
import { useFortuneText } from './fortune-messages';

const NOTICE_MS = 2200;

interface FortuneCardProps {
  readonly que: Que;
  /** One-based stick number shown on the slip. */
  readonly number: number;
  readonly onClose: () => void;
}

export function FortuneCard({ que, number, onClose }: FortuneCardProps): ReactNode {
  const t = useFortuneText();
  const [notice, setNotice] = useState('');
  const [shareable] = useState(canShareText);
  const text = queShareText(que, t('shareFooter'));

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const copy = async (): Promise<void> => {
    setNotice((await copyText(text)) ? t('copied') : t('copyFailed'));
  };

  return (
    <article className="fortune-card" aria-label={t('cardLabel')} data-id="fortune-card">
      <p className="fortune-card-number">{t('stickLabel', { n: number })}</p>
      <h3 className="fortune-card-title" lang="vi">
        {que.title}
      </h3>
      <p className="fortune-card-verse" lang="vi">
        {que.verse[0]}
        <br />
        {que.verse[1]}
      </p>
      <div className="fortune-card-part">
        <p className="fortune-card-label">{t('meaning')}</p>
        <p className="fortune-card-text" lang="vi">
          {que.meaning}
        </p>
      </div>
      <div className="fortune-card-part">
        <p className="fortune-card-label">{t('today')}</p>
        <p className="fortune-card-text" lang="vi">
          {que.advice}
        </p>
      </div>
      <div className="fortune-actions">
        <button type="button" className="btn-primary" onClick={() => void copy()} data-id="fortune-card-copy">
          {t('copy')}
        </button>
        {shareable && (
          <button type="button" className="btn-secondary" onClick={() => void shareText(text)} data-id="fortune-card-share">
            {t('share')}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose} data-id="fortune-card-back">
          {t('again')}
        </button>
      </div>
      <p className="fortune-card-notice" role="status" aria-live="polite">
        {notice}
      </p>
    </article>
  );
}
