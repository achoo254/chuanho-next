/**
 * Everyone in the room with their own stick: a small bar that empties as it burns, and the minutes left. The host
 * sees a small "ask to leave" button on everyone else's row; it asks once more on the row itself (no browser dialog)
 * before the member is removed for good.
 */
import { type ReactNode, useState } from 'react';
import { HudIcon } from '../../hud/hud-icons';
import { useRoomText } from './room-messages';
import type { MemberView } from './room-view-model';

interface RoomMembersProps {
  readonly members: readonly MemberView[];
  /** Removes a member (host only); resolves once the answer is in. */
  readonly onRemove: (memberId: string) => Promise<void>;
}

export function RoomMembers({ members, onRemove }: RoomMembersProps): ReactNode {
  const t = useRoomText();
  // The member whose removal is being confirmed, and whether that removal is on its way.
  const [asking, setAsking] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const hostView = members.some((member) => member.canRemove);

  const confirm = async (memberId: string): Promise<void> => {
    setRemoving(true);
    try {
      await onRemove(memberId);
    } finally {
      setRemoving(false);
      setAsking(null);
    }
  };

  return (
    <section className="room-section" aria-labelledby="room-members-title" data-id="room-members">
      <h3 className="room-section-title" id="room-members-title">
        {t('members', { n: members.length })}
      </h3>
      <ul className={`room-members${hostView ? ' is-host' : ''}`}>
        {members.map((member) => {
          const stick = member.stick;
          const status = !stick ? t('stickNone') : stick.burntOut ? t('stickOut') : t('stickLeft', { n: stick.minutesLeft });
          const name = member.name || t('someone');
          return (
            <li key={member.id} className="room-member" data-id={`room-member-${member.id}`}>
              <span className="room-member-name">
                {name}
                {member.isMe && <span className="room-tag">{t('you')}</span>}
                {member.isHost && <span className="room-tag">{t('host')}</span>}
              </span>
              <span className="room-member-stick" aria-hidden="true">
                <span className="room-member-stick-fill" style={{ width: `${stick ? (1 - stick.progress) * 100 : 0}%` }} />
              </span>
              <span className="room-member-status">{status}</span>
              {hostView && (
                <span className="room-member-action">
                  {member.canRemove && (
                    <button
                      type="button"
                      className="btn-icon room-member-remove"
                      aria-label={t('member.remove', { name })}
                      title={t('member.remove', { name })}
                      aria-expanded={asking === member.id}
                      disabled={removing}
                      onClick={() => setAsking((current) => (current === member.id ? null : member.id))}
                      data-id={`room-member-remove-${member.id}`}
                    >
                      <HudIcon name="signOut" size={18} />
                    </button>
                  )}
                </span>
              )}
              {asking === member.id && (
                <span className="room-member-confirm" role="group" aria-label={t('member.removeAsk', { name })}>
                  <span className="panel-note">{t('member.removeAsk', { name })}</span>
                  <button
                    type="button"
                    className="room-link-button"
                    disabled={removing}
                    onClick={() => void confirm(member.id)}
                    data-id={`room-member-remove-confirm-${member.id}`}
                  >
                    {t('member.removeConfirm')}
                  </button>
                  <button
                    type="button"
                    className="room-link-button"
                    disabled={removing}
                    onClick={() => setAsking(null)}
                    data-id={`room-member-remove-cancel-${member.id}`}
                  >
                    {t('member.removeCancel')}
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
