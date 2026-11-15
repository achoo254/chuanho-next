/**
 * The mascot at the wooden bell: one big tap target. A touch anywhere on it fires on `pointerdown` (no wait for the
 * click), a keyboard press (Enter or Space) fires through the button's click. `onTap` receives the event time so the
 * rhythm mode can judge the exact moment of the touch.
 */
import type { PointerEvent, ReactNode } from 'react';
import { TAP_FRAMES, type TapAnimation } from './use-tap-animation';

interface TapCharacterProps {
  readonly animation: TapAnimation;
  readonly label: string;
  /** Called with the event's timestamp (performance.now() time base). */
  readonly onTap: (eventTimeMs: number) => void;
  /** Floating text, the falling notes' hit line, or anything else drawn over the mascot. */
  readonly children?: ReactNode;
  readonly className?: string;
  readonly dataId?: string;
}

export function TapCharacter({ animation: { imgRef, stageRef }, label, onTap, children, className = '', dataId }: TapCharacterProps): ReactNode {
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return; // main button or a touch only
    onTap(event.timeStamp);
  };
  return (
    <button
      type="button"
      className={`tap-character ${className}`}
      aria-label={label}
      data-id={dataId}
      onPointerDown={onPointerDown}
      // detail 0 = a keyboard "click"; pointer clicks were already handled on pointerdown.
      onClick={(event) => {
        if (event.detail === 0) onTap(event.timeStamp);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={stageRef} className="tap-stage">
        <img ref={imgRef} className="tap-frame" src={TAP_FRAMES.idle} width={640} height={691} alt="" draggable={false} />
      </div>
      {children}
    </button>
  );
}
