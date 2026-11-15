/**
 * The share step of the 3D game: takes the picture from the scene, lays the card over it, previews it, and offers
 * "Post to Story" (Web Share with the file, a download where that is not supported) and "Save image".
 */
import { type ReactNode, useEffect, useState } from 'react';
import { WEB_HOST, brand } from '../brand';
import { useGameSession } from '../game/game-session-context';
import { HudIcon } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { ModeBar } from '../modes/mode-chrome';
import { usePlayText } from '../modes/play-mode-messages';
import type { PlayStage } from '../modes/play-stage';
import { canvasToPng, downloadBlob } from '../share/draw-share-card';
import { shareImageFile } from '../share/share-image-file';
import { composeSceneShareCard } from './compose-scene-share-card';

const FILE_NAME = 'chuanho-the-chia-se.png';

type CardState = { readonly status: 'drawing' } | { readonly status: 'ready'; readonly blob: Blob; readonly url: string } | { readonly status: 'failed' };

export function Share3dPanel({ stage, onBack }: { stage: PlayStage; onBack: () => void }): ReactNode {
  const { t } = useI18n();
  const text = usePlayText();
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
      ...(restraintCount > 0 ? [{ label: restraintLabel, value: restraintCount }] : []),
    ];
    // Let the character settle into its pose for a frame or two before the picture is taken.
    const settle = new Promise<void>((resolve) => window.setTimeout(resolve, 350));
    settle
      .then(() => stage.captureShareShot())
      .then((shot) => composeSceneShareCard(shot, { appName: brand.appName, host: WEB_HOST, tagline, stats }))
      .then(canvasToPng)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ status: 'ready', blob, url });
      })
      .catch((error: unknown) => {
        console.error('3D share card failed', error);
        if (!cancelled) setCard({ status: 'failed' });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stage, progress.bestCombo, progress.peacefulDays, restraintCount, comboLabel, daysLabel, restraintLabel, tagline]);

  return (
    <>
      <ModeBar onBack={onBack} />
      <div className="play-card play-share" data-id="share3d">
        <p className="play-card-title">{t('share.title')}</p>
        {card.status === 'drawing' && (
          <p className="play-card-note" role="status">
            {text('capturing')}
          </p>
        )}
        {card.status === 'failed' && <p role="alert">{t('share.failed')}</p>}
        {card.status === 'ready' && (
          <>
            <img
              className="play-share-preview"
              src={card.url}
              width={1080}
              height={1920}
              alt={t('share.alt', { combo: progress.bestCombo, days: progress.peacefulDays })}
              data-id="share3d-preview"
            />
            <div className="play-card-actions">
              <button
                type="button"
                className="btn-primary play-btn-icon"
                data-id="share3d-post"
                onClick={() => {
                  void shareImageFile(card.blob, FILE_NAME).then((result) => {
                    if (result === 'downloaded') setNotice(t('share.downloaded'));
                  });
                }}
              >
                <HudIcon name="share" size={20} />
                {t('share.post')}
              </button>
              <button
                type="button"
                className="btn-secondary play-btn-icon"
                data-id="share3d-save"
                onClick={() => {
                  downloadBlob(card.blob, FILE_NAME);
                  setNotice(t('share.saved'));
                }}
              >
                <HudIcon name="download" size={20} />
                {t('share.save')}
              </button>
            </div>
          </>
        )}
        <p className="play-card-note" role="status">
          {notice}
        </p>
      </div>
    </>
  );
}
