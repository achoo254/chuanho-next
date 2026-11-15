/** The room's wishes, newest first, each with Delete (author or host) and Report (once per person) where allowed. */
import type { ReactNode } from 'react';
import { useRoomText } from './room-messages';
import type { WishView } from './room-view-model';

interface RoomWishListProps {
  readonly wishes: readonly WishView[];
  readonly onDelete: (wishId: string) => void;
  readonly onReport: (wishId: string) => void;
}

export function RoomWishList({ wishes, onDelete, onReport }: RoomWishListProps): ReactNode {
  const t = useRoomText();
  return (
    <section className="room-section" aria-labelledby="room-wishes-title" data-id="room-wishes">
      <h3 className="room-section-title" id="room-wishes-title">
        {t('wish.title')}
      </h3>
      {wishes.length === 0 ? (
        <p className="panel-note">{t('wish.empty')}</p>
      ) : (
        <ul className="panel-list">
          {wishes.map((wish) => (
            <li key={wish.id} className="panel-list-item room-wish" data-id={`room-wish-${wish.id}`}>
              <p className="room-wish-text">{wish.text}</p>
              <div className="room-wish-meta">
                <span className="panel-note">
                  {wish.mine ? t('you') : wish.authorName || t('someone')}
                  {wish.reports > 0 && ` · ${t('wish.reports', { n: wish.reports })}`}
                </span>
                <span className="room-wish-actions">
                  {wish.canDelete && (
                    <button type="button" className="room-link-button" onClick={() => onDelete(wish.id)} data-id={`room-wish-delete-${wish.id}`}>
                      {t('wish.delete')}
                    </button>
                  )}
                  {wish.reportedByMe && <span className="panel-note">{t('wish.reported')}</span>}
                  {wish.canReport && (
                    <button type="button" className="room-link-button" onClick={() => onReport(wish.id)} data-id={`room-wish-report-${wish.id}`}>
                      {t('wish.report')}
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
