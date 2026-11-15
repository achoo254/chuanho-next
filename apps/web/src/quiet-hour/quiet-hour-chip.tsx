/**
 * The "Giờ Tĩnh" chip in the yard HUD: a countdown in the hour before 22:30, the shared running total (and minutes
 * left) while it is on, tonight's total afterwards, and one small lantern per milestone reached. Hidden the rest of the
 * day and whenever the server has not answered. Re-renders on its own every 15 s for the countdown.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { HudIcon } from '../hud/hud-icons';
import { QUIET_HOUR_START_LABEL, quietHourView } from './quiet-hour-clock';
import { useQuietHourText } from './quiet-hour-messages';
import { useQuietHour } from './quiet-hour-provider';

const TICK_MS = 15_000;

export function QuietHourChip(): ReactNode {
  const { status, offset, signedIn } = useQuietHour();
  const text = useQuietHourText();
  const [deviceNow, setDeviceNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setDeviceNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const view = quietHourView(status, deviceNow + offset);
  if (view.phase === 'hidden') return null;

  const label =
    view.phase === 'before'
      ? text('before', { time: QUIET_HOUR_START_LABEL, n: view.minutes })
      : view.phase === 'open'
        ? text('open', { total: view.total, n: view.minutes })
        : text('after', { total: view.total });
  const milestones = view.phase === 'before' ? [] : view.milestones;
  const tip = [text('about', { time: QUIET_HOUR_START_LABEL }), signedIn ? '' : text('guestHint')].filter(Boolean).join(' ');

  return (
    <div className="game3d-stat quiet-hour-chip" role="status" data-tip={tip} data-id="game3d-quiet-hour">
      <HudIcon name="moon" size={18} />
      <span>{label}</span>
      {milestones.length > 0 && (
        <span className="quiet-hour-lanterns" aria-label={text('milestones', { n: milestones.length })} role="img">
          {milestones.map((mark) => (
            <HudIcon key={mark} name="lantern" size={14} />
          ))}
        </span>
      )}
    </div>
  );
}
