/**
 * Tiểu Đệ, the little novice, now and then says one gentle line in the yard: a chip at the bottom (above the corner
 * bar, clear of the top HUD) with his avatar. First ~25 s after the yard becomes idle, then every 90–150 s, 6 s
 * each; a tap hides it, "not today" silences him until tomorrow. Hidden whenever `visible` is false (a play mode,
 * a panel, the info dialog). He never asks for anything: no money, no sharing, no streaks.
 */
import { type ReactNode, useRef } from 'react';
import { useGameSession } from '../../game/game-session-context';
import { MERIT_PER_FULL_SESSION } from '../../game/player-progress';
import { readStored, writeStored } from '../../game/safe-storage';
import { localDateKey } from '../../game/session-day';
import { TieuDeAvatar } from './tieude-avatar';
import { TIEUDE_LINES, TIEUDE_STORAGE_KEY, type TieuDeLine, isSilenced, meritToday, parseTieuDeSilence, pickTieuDeLine } from './tieude-lines';
import { useTieuDeText } from './tieude-messages';
import { useIdleNudge } from './use-idle-nudge';
import './tieude.css';

const FIRST_MS = 25_000;
const GAP_MS: readonly [number, number] = [90_000, 150_000];
const SHOW_MS = 6_000;

const silencedToday = (): boolean => isSilenced(readStored(TIEUDE_STORAGE_KEY, parseTieuDeSilence), localDateKey(new Date()));

export function TieuDeNudge({ visible }: { readonly visible: boolean }): ReactNode {
  const t = useTieuDeText();
  const { progress } = useGameSession();
  const lastKey = useRef<TieuDeLine['key'] | null>(null);
  // Today's merit only: the lines thank the player for today, not for a running total.
  const merit = meritToday(progress.lastRewardedDay, localDateKey(new Date()), MERIT_PER_FULL_SESSION);

  const nudge = useIdleNudge<TieuDeLine>(visible, {
    firstDelayMs: FIRST_MS,
    gapMs: GAP_MS,
    showMs: SHOW_MS,
    random: Math.random,
    allowed: () => !silencedToday(),
    next: () => {
      const line = pickTieuDeLine(TIEUDE_LINES, { hour: new Date().getHours(), merit, lastKey: lastKey.current, random: Math.random });
      if (line) lastKey.current = line.key;
      return line;
    },
  });

  const silence = (): void => {
    writeStored(TIEUDE_STORAGE_KEY, { silencedDay: localDateKey(new Date()) });
    nudge.dismiss();
  };

  const line = visible ? nudge.current : null;
  return (
    <div className="tieude-layer" aria-live="polite">
      {line && (
        <section key={line.key} className="tieude-nudge" aria-label={t('label')} data-id="tieude-nudge">
          <button type="button" className="tieude-nudge-main" onClick={nudge.dismiss} title={t('dismiss')} data-id="tieude-nudge-dismiss">
            <TieuDeAvatar />
            <span className="tieude-nudge-text">
              <span className="tieude-nudge-name">{t('name')}</span>
              <span className="tieude-nudge-line">{t(line.key, { merit })}</span>
            </span>
          </button>
          <button type="button" className="tieude-nudge-silence" onClick={silence} data-id="tieude-nudge-silence">
            {t('silence')}
          </button>
        </section>
      )}
    </div>
  );
}
