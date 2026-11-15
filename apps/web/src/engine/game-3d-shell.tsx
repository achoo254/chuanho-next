/**
 * The 3D game page (`?v=3d`): a full-window canvas with the HTML HUD over it. The world is the menu: picking a prop
 * (or a corner icon, or keys 1–3) opens its play mode inside the same scene; Esc goes back to the yard. Space/Enter
 * strike the wooden fish wherever striking makes sense. Sound unlocks with the Start tap.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine, playSample, unlockAudio } from '../audio/audio-engine';
import { useLofiBackdrop } from '../audio/use-lofi-backdrop';
import { brand } from '../brand';
import { NoWebglFallback } from '../fallback/no-webgl-fallback';
import { useGameSession } from '../game/game-session-context';
import { ActionToast, type HoverHint, PropHoverHint, type ToastContent } from '../hud/action-toast';
import { CharacterBubble } from '../hud/character-bubble';
import { GameHud } from '../hud/game-hud';
import '../hud/game-3d-hud.css';
import { useHudText } from '../hud/hud-messages';
import { InfoDialog } from '../hud/info-dialog';
import { LoadingScreen, StartOverlay } from '../hud/loading-and-start-overlays';
import type { KeyCommand } from '../input/keyboard-commands';
import { useKeyboardCommands } from '../input/use-keyboard-commands';
import { playDemoParams } from '../modes/play-demo-params';
import { PlayModeLayer } from '../modes/play-mode-layer';
import { type PlayMode, routeActions } from '../modes/play-mode-routing';
import '../modes/play-modes.css';
import { playStrikeFeedback } from '../modes/strike-feedback';
import { requestTiltPermission } from '../scene/use-parallax-tilt';
import { type LightingPresetId, isLightingPresetId } from '../scene/lighting-presets';
import { type InteractivePropId, type WorldAction, actionsForProp, propForAction } from '../scene/world-actions';
import type { BabylonWorld } from './boot-babylon-world';
import { useBabylonWorld } from './use-babylon-world';

const TOAST_MS = 1800;
const CHOICE_MS = 5000;

/** `?light=lanternNight` (or mistyMorning) opens on another time of day; daylight otherwise. */
function presetFromAddress(): LightingPresetId {
  const asked = new URLSearchParams(window.location.search).get('light');
  return isLightingPresetId(asked) ? asked : 'daylight';
}

export function Game3dShell(): ReactNode {
  const text = useHudText();
  const { progress } = useGameSession();
  const demo = useMemo(() => playDemoParams(window.location.search), []);
  const hostRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(demo.mode !== null);
  const [mode, setMode] = useState<PlayMode>(demo.mode ?? 'yard');
  const [infoOpen, setInfoOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [viewChanged, setViewChanged] = useState(false);
  const [toast, setToast] = useState<ToastContent | null>(null);
  const [hint, setHint] = useState<HoverHint | null>(null);
  const [preset, setPreset] = useState<LightingPresetId>(presetFromAddress);
  const toastId = useRef(0);
  const worldRef = useRef<BabylonWorld | null>(null);
  const strikeRef = useRef<((eventTimeMs: number) => void) | null>(null);

  const showToast = useCallback((actions: readonly WorldAction[], choose = false): void => {
    toastId.current += 1;
    setToast({ id: toastId.current, actions, choose });
  }, []);

  const open = useCallback((next: PlayMode): void => {
    setToast(null);
    worldRef.current?.setFocus(null);
    setMode(next);
  }, []);
  const toYard = useCallback(() => open('yard'), [open]);
  const toSessionEnd = useCallback(() => open('sessionEnd'), [open]);

  /** A strike in the yard: just for the joy of it, nothing counted. */
  const yardStrike = useCallback((): void => {
    worldRef.current?.stage.strike();
    playStrikeFeedback();
  }, []);

  /** What picking a prop, a corner icon or a key does (see play-mode-routing.ts). */
  const act = useCallback(
    (actions: readonly WorldAction[], prop: InteractivePropId | null): void => {
      const world = worldRef.current;
      const route = routeActions(actions);
      // The wooden fish answers with the strike itself; other props bounce.
      if (prop && prop !== 'mo' && route.kind !== 'enter') world?.pulse(prop);
      // The character looks over at whatever was tapped in the yard (opening a mode calls it over instead).
      if (prop && route.kind !== 'enter') world?.stage.notice(prop);
      switch (route.kind) {
        case 'enter':
          open(route.mode);
          return;
        case 'choose':
          if (prop) world?.setFocus(prop);
          showToast(route.actions, true);
          return;
        case 'sound':
          playSample(route.sample);
          showToast(actions);
          return;
        case 'strike':
          yardStrike();
          return;
        case 'soon':
          if (prop) world?.setFocus(prop);
          showToast(route.actions);
          return;
        case 'none':
          return;
      }
    },
    [open, showToast, yardStrike],
  );

  const handlers = useMemo(
    () => ({
      onPick: (prop: InteractivePropId) => act(actionsForProp(prop), prop),
      onHover: (prop: InteractivePropId | null, x: number, y: number) => setHint(prop ? { prop, x, y } : null),
    }),
    [act],
  );
  const { status, progress: loaded, world } = useBabylonWorld(hostRef, text('canvas'), preset, handlers);
  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  const runAction = useCallback((action: WorldAction) => act([action], propForAction(action)), [act]);

  useEffect(() => {
    document.title = brand.appName;
  }, []);
  useEffect(() => {
    world?.stage.setMode(mode);
    world?.armRenderGuard();
  }, [world, mode]);
  useEffect(() => {
    world?.setInputEnabled(started && !infoOpen && mode === 'yard');
    // A play mode has its own shot, so the free view always starts from the framed default.
    if (mode !== 'yard') world?.adjustView('reset');
  }, [world, started, infoOpen, mode]);
  useEffect(() => {
    world?.stage.setMoSkin(progress.moSkin);
    world?.stage.setProgress(progress);
  }, [world, progress]);
  useEffect(() => {
    if (world && demo.freezeStrikeMs !== null) world.stage.freezeStrike(demo.freezeStrikeMs);
  }, [world, demo.freezeStrikeMs]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => {
        setToast(null);
        worldRef.current?.setFocus(null);
      },
      toast.choose ? CHOICE_MS : TOAST_MS,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  const onKeyCommand = useCallback(
    (command: KeyCommand, eventTimeMs: number): void => {
      if (command.kind === 'back') {
        setInfoOpen(false);
        if (mode !== 'yard') toYard();
        setToast(null);
        worldRef.current?.setFocus(null);
        return;
      }
      if (infoOpen) return;
      if (command.kind === 'view') {
        if (mode === 'yard') worldRef.current?.adjustView(command.change);
        return;
      }
      if (command.action === 'strike') {
        // Any mode that registered a strike handler (drumming modes, and panels that ask for strokes) gets Space.
        if (mode === 'yard') yardStrike();
        else strikeRef.current?.(eventTimeMs);
        return;
      }
      runAction(command.action);
    },
    [infoOpen, mode, runAction, toYard, yardStrike],
  );
  useKeyboardCommands(started && status === 'ready', onKeyCommand);

  const changePreset = useCallback(
    (next: LightingPresetId): void => {
      setPreset(next);
      world?.setLightingPreset(next);
    },
    [world],
  );

  const lighting = useMemo(() => ({ preset, set: changePreset }), [preset, changePreset]);

  const toggleSound = useCallback((): void => {
    const ctx = audioEngine()?.ctx;
    if (!ctx) return;
    const next = !muted;
    (next ? ctx.suspend() : ctx.resume()).catch((error: unknown) => console.warn('Sound toggle failed', error));
    setMuted(next);
  }, [muted]);

  // The calm library music plays under the whole game (the modes that want it share the same session).
  useLofiBackdrop(started && !muted);

  const start = useCallback((): void => {
    unlockAudio();
    void requestTiltPermission();
    setStarted(true);
  }, []);

  // The reset-view button appears once the player has moved the free camera (checked a few times a second).
  useEffect(() => {
    if (!world || !started) return;
    const timer = window.setInterval(() => setViewChanged(world.isViewChanged()), 250);
    return () => window.clearInterval(timer);
  }, [world, started]);

  const registerStrike = useCallback((handler: ((eventTimeMs: number) => void) | null): void => {
    strikeRef.current = handler;
  }, []);

  return (
    // Any first tap (also in a mode opened straight from the address) unlocks sound, as browsers require.
    <div className="game3d" data-id="game3d" data-mode={mode} onPointerDownCapture={started && !muted ? unlockAudio : undefined}>
      <div ref={hostRef} className="game3d-stage" />
      {status === 'unsupported' && <NoWebglFallback />}
      {status === 'loading' && <LoadingScreen progress={loaded} />}
      {status === 'ready' && world && (
        <>
          {started && <PlayModeLayer mode={mode} world={world} previewSongMs={demo.songMs} lighting={lighting} onBack={toYard} onOpen={open} onSessionComplete={toSessionEnd} registerStrike={registerStrike} />}
          {started && (
            <GameHud
              preset={preset}
              showBar={mode === 'yard'}
              muted={muted}
              onAction={runAction}
              onPreset={changePreset}
              onToggleSound={toggleSound}
              onInfo={() => setInfoOpen(true)}
              viewChanged={viewChanged && mode === 'yard'}
              onResetView={() => world.adjustView('reset')}
            />
          )}
          {started && <CharacterBubble stage={world.stage} visible={mode === 'yard' && !infoOpen} />}
          <ActionToast toast={toast} onChoose={(action) => runAction(action)} />
          <PropHoverHint hint={started && mode === 'yard' ? hint : null} />
          {!started && <StartOverlay onStart={start} />}
          <InfoDialog open={infoOpen} onClose={() => setInfoOpen(false)} />
        </>
      )}
    </div>
  );
}
