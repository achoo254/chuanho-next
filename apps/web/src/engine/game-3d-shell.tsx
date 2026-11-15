/**
 * The 3D game page (`?v=3d`): a full-window canvas with the HTML HUD over it. It wires the world to the HUD, the
 * keyboard and sound. Picking a thing in the yard is only recorded for now (a toast with its icons and a bounce in
 * the scene); the play modes move into this shell next.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine, buzz, playSample, unlockAudio } from '../audio/audio-engine';
import { brand } from '../brand';
import { NoWebglFallback } from '../fallback/no-webgl-fallback';
import { ActionToast, type HoverHint, PropHoverHint, type ToastContent } from '../hud/action-toast';
import { GameHud } from '../hud/game-hud';
import '../hud/game-3d-hud.css';
import { useHudText } from '../hud/hud-messages';
import { InfoDialog } from '../hud/info-dialog';
import { LoadingScreen, StartOverlay } from '../hud/loading-and-start-overlays';
import type { KeyCommand } from '../input/keyboard-commands';
import { useKeyboardCommands } from '../input/use-keyboard-commands';
import { requestTiltPermission } from '../scene/use-parallax-tilt';
import { type LightingPresetId, isLightingPresetId } from '../scene/lighting-presets';
import { type InteractivePropId, type WorldAction, actionsForProp, propForAction } from '../scene/world-actions';
import type { BabylonWorld } from './boot-babylon-world';
import { useBabylonWorld } from './use-babylon-world';

const TOAST_MS = 1800;

/** `?light=lanternNight` (or mistyMorning) opens on another time of day; sunset otherwise. */
function presetFromAddress(): LightingPresetId {
  const asked = new URLSearchParams(window.location.search).get('light');
  return isLightingPresetId(asked) ? asked : 'sunset';
}

/** The sound that answers an action right away (the play modes themselves come later). */
function soundFor(actions: readonly WorldAction[]): void {
  if (actions.includes('bell')) playSample('bell');
  else if (actions.includes('bowl')) playSample('bowl');
  else if (actions.includes('strike') || actions.includes('beat') || actions.includes('endless')) {
    playSample('mo');
    buzz(12);
  }
}

export function Game3dShell(): ReactNode {
  const text = useHudText();
  const hostRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const [hint, setHint] = useState<HoverHint | null>(null);
  const [preset, setPreset] = useState<LightingPresetId>(presetFromAddress);
  const toastId = useRef(0);
  const worldRef = useRef<BabylonWorld | null>(null);

  /** Records a pick: the prop bounces (and glows until the toast fades), its sound plays, the toast shows icons. */
  const record = useCallback((actions: readonly WorldAction[], prop: InteractivePropId | null): void => {
    if (actions.length === 0) return;
    const world = worldRef.current;
    if (prop) {
      world?.pulse(prop);
      world?.setFocus(prop);
    }
    soundFor(actions);
    toastId.current += 1;
    setToast({ id: toastId.current, actions });
    console.info('3D yard action:', actions.join(', '));
  }, []);

  const handlers = useMemo(
    () => ({
      onPick: (prop: InteractivePropId) => record(actionsForProp(prop), prop),
      onHover: (prop: InteractivePropId | null, x: number, y: number) => setHint(prop ? { prop, x, y } : null),
    }),
    [record],
  );
  const { status, progress, world } = useBabylonWorld(hostRef, text('canvas'), preset, handlers);
  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  const runAction = useCallback((action: WorldAction) => record([action], propForAction(action)), [record]);

  useEffect(() => {
    document.title = brand.appName;
  }, []);
  useEffect(() => {
    world?.setInputEnabled(started && !infoOpen);
  }, [world, started, infoOpen]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
      worldRef.current?.setFocus(null);
    }, TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const onKeyCommand = useCallback(
    (command: KeyCommand): void => {
      if (command.kind === 'action') {
        if (!infoOpen) runAction(command.action);
        return;
      }
      setInfoOpen(false);
      setToast(null);
      worldRef.current?.setFocus(null);
    },
    [infoOpen, runAction],
  );
  useKeyboardCommands(started && status === 'ready', onKeyCommand);

  const changePreset = useCallback(
    (next: LightingPresetId): void => {
      setPreset(next);
      world?.setLightingPreset(next);
    },
    [world],
  );

  const toggleSound = useCallback((): void => {
    const ctx = audioEngine()?.ctx;
    if (!ctx) return;
    const next = !muted;
    (next ? ctx.suspend() : ctx.resume()).catch((error: unknown) => console.warn('Sound toggle failed', error));
    setMuted(next);
  }, [muted]);

  const start = useCallback((): void => {
    unlockAudio();
    void requestTiltPermission();
    setStarted(true);
  }, []);

  return (
    <div className="game3d" data-id="game3d">
      <div ref={hostRef} className="game3d-stage" />
      {status === 'unsupported' && <NoWebglFallback />}
      {status === 'loading' && <LoadingScreen progress={progress} />}
      {status === 'ready' && (
        <>
          {started && (
            <GameHud preset={preset} muted={muted} onAction={runAction} onPreset={changePreset} onToggleSound={toggleSound} onInfo={() => setInfoOpen(true)} />
          )}
          <ActionToast toast={toast} />
          <PropHoverHint hint={started ? hint : null} />
          {!started && <StartOverlay onStart={start} />}
          <InfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} />
        </>
      )}
    </div>
  );
}
