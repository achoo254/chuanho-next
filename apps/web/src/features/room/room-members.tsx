/** Everyone in the room with their own stick: a small bar that empties as it burns, and the minutes left. */
import type { ReactNode } from 'react';
import { useRoomText } from './room-messages';
import type { MemberView } from './room-view-model';

export function RoomMembers({ members }: { readonly members: readonly MemberView[] }): ReactNode {
  const t = useRoomText();
  return (
    <section className="room-section" aria-labelledby="room-members-title" data-id="room-members">
      <h3 className="room-section-title" id="room-members-title">
        {t('members', { n: members.length })}
      </h3>
      <ul className="room-members">
        {members.map((member) => {
          const stick = member.stick;
          const status = !stick ? t('stickNone') : stick.burntOut ? t('stickOut') : t('stickLeft', { n: stick.minutesLeft });
          return (
            <li key={member.id} className="room-member" data-id={`room-member-${member.id}`}>
              <span className="room-member-name">
                {member.name || t('someone')}
                {member.isMe && <span className="room-tag">{t('you')}</span>}
                {member.isHost && <span className="room-tag">{t('host')}</span>}
              </span>
              <span className="room-member-stick" aria-hidden="true">
                <span className="room-member-stick-fill" style={{ width: `${stick ? (1 - stick.progress) * 100 : 0}%` }} />
              </span>
              <span className="room-member-status">{status}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
