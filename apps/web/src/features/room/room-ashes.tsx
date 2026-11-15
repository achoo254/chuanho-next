/**
 * The incense is out: drifting ash over the burner, the "cleansed together" line, and the share card (room name,
 * theme, people and sticks only) to post to a Story or save. The wishes are already gone on the server.
 */
import type { RoomSnapshot } from '@chuanho/contract';
import { type ReactNode, useEffect, useState } from 'react';
import { WEB_HOST, brand } from '../../brand';
import { canvasToPng, downloadBlob } from '../../share/draw-share-card';
import { shareImageFile } from '../../share/share-image-file';
import { RoomCenser } from './room-censer';
import { useRoomText } from './room-messages';
import { drawRoomShareCard } from './room-share-card';
import type { RoomView } from './room-view-model';

const FILE_NAME = 'phong-giai-nghiep.png';

type CardState = { readonly status: 'drawing' } | { readonly status: 'ready'; readonly blob: Blob; readonly url: string } | { readonly status: 'failed' };

interface RoomAshesProps {
  readonly snapshot: RoomSnapshot;
  readonly view: RoomView;
}

export function RoomAshes({ snapshot, view }: RoomAshesProps): ReactNode {
  const t = useRoomText();
  const [card, setCard] = useState<CardState>({ status: 'drawing' });
  const [notice, setNotice] = useState('');
  const people = snapshot.members.length;

  const tagline = t('card.tagline');
  const themeLabel = t(`theme.${snapshot.theme}`);
  const membersLabel = t('card.members');
  const sticksLabel = t('card.sticks');
  useEffect(() => {
    let cancelled = false;
    let url = '';
    const stats = [
      { label: membersLabel, value: people },
      { label: sticksLabel, value: snapshot.litTotal },
    ];
    drawRoomShareCard({ appName: brand.appName, host: WEB_HOST, tagline, stats, roomName: snapshot.name, themeLabel })
      .then(canvasToPng)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ status: 'ready', blob, url });
      })
      .catch((error: unknown) => {
        console.error('Room share card failed', error);
        if (!cancelled) setCard({ status: 'failed' });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [people, snapshot.litTotal, snapshot.name, tagline, themeLabel, membersLabel, sticksLabel]);

  return (
    <div className="room-ashes" data-id="room-ashes">
      <RoomCenser members={view.members} smoke={0} milestone={view.milestone} ashes label={t('ashes.title')} />
      <p className="panel-line">{t('ashes.title')}</p>
      <p className="panel-line room-ashes-line">{t('ashes.line', { name: snapshot.name, n: people })}</p>
      <p className="panel-note">{t('ashes.note')}</p>
      {card.status === 'drawing' && (
        <p className="panel-note" role="status">
          {t('ashes.drawing')}
        </p>
      )}
      {card.status === 'failed' && <p role="alert">{t('ashes.failed')}</p>}
      {card.status === 'ready' && (
        <>
          <img className="room-card-preview" src={card.url} width={1080} height={1920} alt={t('ashes.alt', { name: snapshot.name, n: people })} data-id="room-card-preview" />
          <div className="room-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void shareImageFile(card.blob, FILE_NAME).then((result) => result === 'downloaded' && setNotice(t('ashes.saved')))}
              data-id="room-card-post"
            >
              {t('ashes.post')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                downloadBlob(card.blob, FILE_NAME);
                setNotice(t('ashes.saved'));
              }}
              data-id="room-card-save"
            >
              {t('ashes.save')}
            </button>
          </div>
        </>
      )}
      <p className="panel-note" role="status">
        {notice}
      </p>
    </div>
  );
}
