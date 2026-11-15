/**
 * Pieces every 3D play mode shares: the props a mode receives, the invisible full-screen strike pad (the whole screen
 * is the wooden fish, struck on pointerdown), the corner bar with the way back and the mode's small chips, words that
 * pop up over the wooden fish, and the card shown when a session step is done.
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { type SessionStep, useGameSession } from '../game/game-session-context';
import { HudIcon, IconButton } from '../hud/hud-icons';
import { useI18n } from '../i18n/i18n';
import { FloatingTextLayer, type useFloatingText } from '../ui/floating-text';
import { usePlayText } from './play-mode-messages';
import { type PlayMode, nextSessionStep } from './play-mode-routing';
import type { PlayStage } from './play-stage';

export interface PlayModeProps {
  readonly stage: PlayStage;
  onBack(): void;
  onOpen(mode: PlayMode): void;
  onSessionComplete(): void;
  /** The mode's strike handler for the keyboard (Space/Enter), or null when it has none right now. */
  registerStrike(handler: ((eventTimeMs: number) => void) | null): void;
}

/** Hands the mode's strike to the keyboard while mounted. */
export function useRegisterStrike(register: PlayModeProps['registerStrike'], handler: (eventTimeMs: number) => void): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  }, [handler]);
  useEffect(() => {
    register((time) => latest.current(time));
    return () => register(null);
  }, [register]);
}

/** The whole screen as the wooden fish. Pointer strikes on pointerdown; a keyboard press on the pad strikes too. */
export function StrikeTapLayer({ label, onStrike, dataId }: { label: string; onStrike: (eventTimeMs: number) => void; dataId: string }): ReactNode {
  return (
    <button
      type="button"
      className="play-strike-pad"
      aria-label={label}
      data-id={dataId}
      onPointerDown={(event) => {
        if (event.button > 0) return;
        onStrike(event.timeStamp);
      }}
      // Only keyboard "clicks" (detail 0) strike here: a pointer already struck on pointerdown.
      onClick={(event) => {
        if (event.detail === 0) onStrike(event.timeStamp);
      }}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

export function ModeBar({ onBack, children }: { onBack: () => void; children?: ReactNode }): ReactNode {
  const text = usePlayText();
  return (
    <div className="play-bar" data-id="play-bar">
      <IconButton icon="back" label={text('back')} dataId="play-back" onClick={onBack} />
      {children}
    </div>
  );
}

/** Words (PERFECT, GOOD, +1) that rise from the top of the wooden fish, wherever the camera has put it. */
export function MoFloatAnchor({ stage, items }: { stage: PlayStage; items: ReturnType<typeof useFloatingText>['items'] }): ReactNode {
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const follow = (): void => {
      const point = stage.moTopOnScreen();
      if (anchor.current && point) anchor.current.style.transform = `translate(${point.x}px, ${point.y - 40}px)`;
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [stage]);
  return (
    <div ref={anchor} className="play-float-anchor">
      <FloatingTextLayer items={items} />
    </div>
  );
}

const STEP_LABELS = { incense: 'yard.step.incense', beat: 'yard.step.beat', sutra: 'yard.step.sutra' } as const;
const STEP_ICONS = { incense: 'incense', beat: 'mo', sutra: 'sutra' } as const;

/** A step of today's session is done: what is next, or back to the yard. */
export function StepDoneCard({ title, onOpen, onBack, children }: { title: string; onOpen: (mode: PlayMode) => void; onBack: () => void; children?: ReactNode }): ReactNode {
  const { t } = useI18n();
  const text = usePlayText();
  const { steps } = useGameSession();
  const next: SessionStep | null = nextSessionStep(steps);
  const done = Object.values(steps).filter(Boolean).length;
  return (
    <div className="play-card" role="status" data-id="play-step-done">
      <p className="play-card-title">{title}</p>
      {children}
      <p className="play-card-note">{text('sessionProgress', { done })}</p>
      <div className="play-card-actions">
        <button type="button" className="btn-secondary" data-id="play-step-back" onClick={onBack}>
          {t('common.backToYard')}
        </button>
        {next && (
          <button type="button" className="btn-primary play-btn-icon" data-id="play-step-next" onClick={() => onOpen(next)}>
            <HudIcon name={STEP_ICONS[next]} size={20} />
            {text('next', { step: t(STEP_LABELS[next]) })}
          </button>
        )}
      </div>
    </div>
  );
}
