/**
 * "Xin xăm": one quẻ per local day on this device. The player shakes the stick tube (button, Space or a real shake of
 * the phone), one stick rises out, and the slip of the day shows. Drawing again the same day shows the same slip and
 * says so; the next day brings a new one (fortune-pick.ts). The deck is a static file; nothing leaves the device.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buzz, playSample } from '../../audio/audio-engine';
import { localDateKey } from '../../game/session-day';
import { useI18n } from '../../i18n/i18n';
import { useRegisterStrike } from '../../modes/mode-chrome';
import { PanelFrame } from '../panel-frame';
import type { PanelProps } from '../panel-registry';
import { FortuneCard } from './fortune-card';
import { type QueDeck, loadQueDeck } from './fortune-deck';
import { useFortuneText } from './fortune-messages';
import { type FortuneDraw, drewToday } from './fortune-pick';
import { useShakeGesture } from './fortune-shake';
import { drawAndKeep, readFortuneState } from './fortune-store';
import { FortuneTube } from './fortune-tube';
import './fortune.css';

/** How long the tube rattles before the stick is out, and how long the stick shows before the slip opens. */
const SHAKE_MS = 1300;
const RISE_MS = 700;
/** With reduced motion: no rattle, just a short fade. */
const CALM_MS = 300;

type DeckState = { readonly status: 'loading' } | { readonly status: 'failed' } | { readonly status: 'ready'; readonly deck: QueDeck };
type Phase = 'idle' | 'shaking' | 'out' | 'shown';

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function FortunePanel({ onBack, registerStrike }: PanelProps): ReactNode {
  const t = useFortuneText();
  const { t: appText } = useI18n();
  const [deckState, setDeckState] = useState<DeckState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [draw, setDraw] = useState<FortuneDraw | null>(null);

  useEffect(() => {
    let live = true;
    // loadQueDeck never rejects: a missing or broken file resolves to null.
    void loadQueDeck().then((deck) => {
      if (live) setDeckState(deck ? { status: 'ready', deck } : { status: 'failed' });
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  // The rattle, then the stick out, then the slip; each step owns its timer so leaving the panel cancels it.
  useEffect(() => {
    if (phase !== 'shaking' && phase !== 'out') return;
    const calm = prefersReducedMotion();
    const delay = calm ? CALM_MS : phase === 'shaking' ? SHAKE_MS : RISE_MS;
    const timer = window.setTimeout(() => {
      if (phase === 'shaking') {
        playSample('chime', { gain: 0.7 });
        buzz(40);
      }
      setPhase(phase === 'shaking' ? 'out' : 'shown');
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const deck = deckState.status === 'ready' ? deckState.deck : null;

  // The button, a held Space and a phone shake can all fire before React re-renders; this ref lets only the first in.
  const resting = useRef(true);
  useEffect(() => {
    resting.current = phase === 'idle';
  }, [phase]);

  const shake = useCallback((): void => {
    if (!deck || phase !== 'idle' || !resting.current) return;
    resting.current = false;
    const next = drawAndKeep(deck.que.length);
    setDraw(next);
    if (next.again) {
      buzz(15);
      setPhase('shown');
      return;
    }
    buzz([30, 60, 30, 60, 30]);
    setPhase('shaking');
  }, [deck, phase]);

  useRegisterStrike(registerStrike, shake);
  useShakeGesture(deck !== null && phase === 'idle', shake);

  const retry = (): void => {
    setDeckState({ status: 'loading' });
    setAttempt((count) => count + 1);
  };

  const que = deck && draw ? deck.que[draw.index] : undefined;
  // Read again whenever the tube comes back to rest, so a draw made a moment ago (or in another tab) counts.
  const already = useMemo(() => phase === 'idle' && deck !== null && drewToday(readFortuneState(), localDateKey(new Date()), deck.que.length), [deck, phase]);
  const stickNumber = draw ? draw.index + 1 : null;

  return (
    <PanelFrame title={t('title')} onBack={onBack} dataId="fortune-panel">
      {phase !== 'shown' && <p className="panel-note">{t('intro')}</p>}
      {deckState.status === 'loading' && (
        <p className="panel-line" role="status">
          {t('loading')}
        </p>
      )}
      {deckState.status === 'failed' && (
        <div className="fortune-stack" role="alert">
          <p className="panel-line">{t('failed')}</p>
          <div className="fortune-actions">
            <button type="button" className="btn-secondary" onClick={retry} data-id="fortune-panel-retry">
              {t('retry')}
            </button>
          </div>
        </div>
      )}
      {deck && phase !== 'shown' && (
        <div className="fortune-stack fortune-stage">
          <FortuneTube phase={phase} stickNumber={phase === 'out' ? stickNumber : null} label={t('tube')} />
          <button type="button" className="btn-primary fortune-shake-btn" onClick={shake} disabled={phase !== 'idle'} data-id="fortune-panel-shake">
            {phase === 'idle' ? (already ? t('reshow') : t('shake')) : t('shaking')}
          </button>
          <p className="panel-note" role="status" aria-live="polite">
            {phase === 'out' && stickNumber !== null ? t('stickLabel', { n: stickNumber }) : phase !== 'idle' ? '' : already ? t('alreadyToday') : t('shakeHint')}
          </p>
        </div>
      )}
      {phase === 'shown' && que && draw && (
        <>
          {draw.again && <p className="panel-line fortune-again">{t('alreadyToday')}</p>}
          <FortuneCard que={que} number={draw.index + 1} onClose={() => setPhase('idle')} />
        </>
      )}
      <p className="panel-note">{t('notAdvice')}</p>
      <p className="panel-note">{appText('layout.disclaimer')}</p>
    </PanelFrame>
  );
}
