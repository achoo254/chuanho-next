/**
 * The two full-screen layers before play: the game-style loading screen (a pulsing wooden fish and a progress bar,
 * no words on screen) and the Start button over the finished yard.
 *
 * Start is a click, not a pointerdown: iOS only counts a completed tap as the gesture that unlocks audio and the
 * motion sensors, and both are asked for right here.
 */
import type { ReactNode } from 'react';
import { HudIcon } from './hud-icons';
import { useHudText } from './hud-messages';

export function LoadingScreen({ progress }: { progress: number }): ReactNode {
  const text = useHudText();
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="game3d-loading" data-id="game3d-loading">
      <span className="game3d-loading-mark">
        <HudIcon name="mo" size={56} />
      </span>
      <div
        className="game3d-progress"
        role="progressbar"
        aria-label={text('loading')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="game3d-progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}

export function StartOverlay({ onStart }: { onStart: () => void }): ReactNode {
  const text = useHudText();
  return (
    <div className="game3d-start" data-id="game3d-start">
      <button type="button" className="game3d-start-btn" aria-label={text('start')} data-tip={text('start')} data-id="game3d-start-btn" onClick={onStart}>
        <HudIcon name="play" size={40} />
      </button>
    </div>
  );
}
