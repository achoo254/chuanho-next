/**
 * The share card screen: draws the card, previews it, and offers "Post to Story" (the Web Share API with the image
 * file where supported, a download otherwise) and "Save image" (a download).
 */
import { type ReactNode, useEffect, useState } from 'react';
import { WEB_HOST, brand } from '../brand';
import { useGameSession } from '../game/game-session-context';
import { useI18n } from '../i18n/i18n';
import { ScreenHeader } from '../ui/screen-header';
import { canvasToPng, downloadBlob, drawShareCard } from './draw-share-card';

const FILE_NAME = 'chuanho-the-chia-se.png';

type CardState = { status: 'drawing' } | { status: 'ready'; blob: Blob; url: string } | { status: 'failed' };

export function ShareCardScreen({ onBack }: { onBack: () => void }): ReactNode {
  const { t } = useI18n();
  const { progress, restraintCount } = useGameSession();
  const [card, setCard] = useState<CardState>({ status: 'drawing' });
  const [notice, setNotice] = useState('');

  const comboLabel = t('share.card.combo');
  const daysLabel = t('share.card.days');
  const restraintLabel = t('share.card.restraint');
  const tagline = t('share.card.tagline');
  useEffect(() => {
    let cancelled = false;
    let url = '';
    const stats = [
      { label: comboLabel, value: progress.bestCombo },
      { label: daysLabel, value: progress.peacefulDays },
      // Shown only when there is something to show off.
      ...(restraintCount > 0 ? [{ label: restraintLabel, value: restraintCount }] : []),
    ];
    drawShareCard({ appName: brand.appName, host: WEB_HOST, tagline, stats })
      .then(canvasToPng)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ status: 'ready', blob, url });
      })
      .catch((error: unknown) => {
        console.error('Share card failed', error);
        if (!cancelled) setCard({ status: 'failed' });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [progress.bestCombo, progress.peacefulDays, restraintCount, comboLabel, daysLabel, restraintLabel, tagline]);

  async function post(blob: Blob): Promise<void> {
    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (error) {
        // The player closing the share sheet is not an error.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.warn('Share failed, downloading instead', error);
      }
    }
    downloadBlob(blob, FILE_NAME);
    setNotice(t('share.downloaded'));
  }

  return (
    <section className="game-screen share-screen" data-id="share">
      <ScreenHeader title={t('share.title')} onBack={onBack} />
      <div className="share-body">
        {card.status === 'drawing' && <p role="status">{t('share.drawing')}</p>}
        {card.status === 'failed' && <p role="alert">{t('share.failed')}</p>}
        {card.status === 'ready' && (
          <>
            <img
              className="share-preview"
              src={card.url}
              width={1080}
              height={1920}
              alt={t('share.alt', { combo: progress.bestCombo, days: progress.peacefulDays })}
              data-id="share-preview"
            />
            <div className="level-row">
              <button type="button" className="btn-primary" data-id="share-post" onClick={() => void post(card.blob)}>
                {t('share.post')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                data-id="share-save"
                onClick={() => {
                  downloadBlob(card.blob, FILE_NAME);
                  setNotice(t('share.saved'));
                }}
              >
                {t('share.save')}
              </button>
            </div>
          </>
        )}
        <p className="session-note" role="status">
          {notice}
        </p>
      </div>
    </section>
  );
}
