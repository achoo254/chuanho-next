/**
 * Starts the 3D yard inside `host` and hands back a small control surface for the React layer. This module and
 * everything it imports is the heavy, lazily loaded part of the game (Babylon.js); the 2D page never loads it.
 *
 * Boot order (reported through `onProgress`): engine, sky and camera, kit assets one by one, shaders compiled.
 * An abort (the page unmounting mid-boot) tears down whatever was made so far.
 */
import { HighlightLayer } from '@babylonjs/core/Layers/highlightLayer';
import '@babylonjs/core/Layers/effectLayerSceneComponent';
import { Scene } from '@babylonjs/core/scene';
import { createCameraSwayInput } from '../input/camera-sway-input';
import { createWorldPicking } from '../input/world-picking';
import { type PlayStage, createPlayStage } from '../modes/play-stage';
import { buildDiorama } from '../scene/build-diorama';
import { createDioramaCamera } from '../scene/diorama-camera';
import type { LightingPresetId } from '../scene/lighting-presets';
import { createMaterialPalette } from '../scene/placeholder-materials';
import { createPostProcessing } from '../scene/post-processing';
import { createSceneLighting } from '../scene/scene-lighting';
import { createGardenBackdrop } from '../scene/backdrop-garden';
import { createSkyDome } from '../scene/sky-dome';
import { tokenColor3 } from '../scene/token-colours';
import type { InteractivePropId } from '../scene/world-actions';
import { type RenderBackend, createRenderEngine } from './create-render-engine';
import type { RendererPreference } from './game-3d-flag';
import { startingQualityLevel } from './quality-levels';
import { createRenderGuard, warmUpScene } from './warm-up-scene';
import { createQualityScaler } from './quality-scaler';
import { createPropPulse } from './prop-pulse';
import { configureSelfHostedDecoders } from './self-hosted-decoders';

export interface WorldBootOptions {
  readonly host: HTMLElement;
  readonly canvasLabel: string;
  readonly preference: RendererPreference;
  readonly reducedMotion: boolean;
  readonly coarsePointer: boolean;
  readonly initialPreset: LightingPresetId;
  /** A rung to hold instead of scaling automatically, or null. */
  readonly pinnedQuality: number | null;
  readonly signal: AbortSignal;
  onProgress(fraction: number): void;
  onPick(prop: InteractivePropId): void;
  onHover(prop: InteractivePropId | null, clientX: number, clientY: number): void;
}

export interface BabylonWorld {
  readonly backend: RenderBackend;
  readonly lightingPreset: LightingPresetId;
  setLightingPreset(id: LightingPresetId): void;
  /** A quick squash-and-bounce on a prop: the scene's answer to a tap or a key. */
  pulse(prop: InteractivePropId): void;
  setFocus(prop: InteractivePropId | null): void;
  setInputEnabled(enabled: boolean): void;
  /** True once the player has turned or zoomed the free camera away from the framed view. */
  isViewChanged(): boolean;
  /** The free camera: zoom in or out by a step, or back to the framed view. */
  adjustView(change: 'reset' | 'in' | 'out'): void;
  /** The tappable prop under a screen point (CSS pixels), or null. */
  pickPropAt(clientX: number, clientY: number): InteractivePropId | null;
  /** The play modes' handle on the scene: character, wooden fish, incense, note orbs, share shot. */
  readonly stage: PlayStage;
  dispose(): void;
}

export type WorldBootResult = { readonly kind: 'ready'; readonly world: BabylonWorld } | { readonly kind: 'unsupported' };

class BootAborted extends Error {}

export async function bootBabylonWorld(options: WorldBootOptions): Promise<WorldBootResult> {
  const { host, signal, reducedMotion } = options;
  const cleanups: Array<() => void> = [];
  const disposeAll = (): void => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        console.warn('3D clean-up step failed', error);
      }
    }
  };
  const checkAborted = (): void => {
    if (signal.aborted) throw new BootAborted('3D boot cancelled');
  };

  try {
    configureSelfHostedDecoders();
    const makeCanvas = (): HTMLCanvasElement => {
      const canvas = document.createElement('canvas');
      canvas.className = 'game3d-canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', options.canvasLabel);
      host.prepend(canvas);
      return canvas;
    };
    const created = await createRenderEngine(makeCanvas, options.preference);
    if (!created) return { kind: 'unsupported' };
    const { engine, backend, canvas } = created;
    cleanups.push(() => canvas.remove(), () => engine.dispose());
    checkAborted();
    options.onProgress(0.4);

    const scene = new Scene(engine);
    scene.skipPointerMovePicking = true; // picking is done by world-picking, once per frame at most
    scene.skipPointerDownPicking = true;
    scene.skipPointerUpPicking = true;
    cleanups.push(() => scene.dispose());
    const palette = createMaterialPalette(scene);
    const sky = createSkyDome(scene);
    const backdrop = createGardenBackdrop(scene, reducedMotion);
    const view = createDioramaCamera(scene, reducedMotion);
    const post = createPostProcessing(scene, view.camera);
    cleanups.push(() => post.dispose(), () => sky.dispose(), () => backdrop.dispose(), () => palette.dispose());

    const diorama = await buildDiorama(scene, palette, signal, (done, total) => options.onProgress(0.4 + (done / total) * 0.45));
    cleanups.push(() => diorama.dispose());
    checkAborted();
    const pulse = createPropPulse(diorama.props);
    const stage = await createPlayStage({
      scene,
      engine,
      view,
      focusAt: (distance) => post.focusAt(distance),
      diorama,
      palette,
      reducedMotion,
      signal,
      pulseProp: (prop) => pulse.start(prop),
    });
    cleanups.push(() => stage.dispose());
    checkAborted();

    const lighting = createSceneLighting({ scene, palette, sky, post, shadowCasters: [...diorama.shadowCasters, ...stage.shadowCasters], reducedMotion, backdrop }, options.initialPreset);
    cleanups.push(() => lighting.dispose());
    const highlight = new HighlightLayer('hover-glow', scene, { blurHorizontalSize: 0.8, blurVerticalSize: 0.8 });
    highlight.innerGlow = false;
    cleanups.push(() => highlight.dispose());
    const sway = createCameraSwayInput(reducedMotion);
    cleanups.push(() => sway.dispose());
    const picking = createWorldPicking({
      scene,
      canvas,
      props: diorama.props,
      highlight,
      glow: tokenColor3('--c-primary'),
      sway,
      onPick: options.onPick,
      onHover: options.onHover,
    });
    cleanups.push(() => picking.dispose());
    const startLevel = options.pinnedQuality ?? startingQualityLevel(options.coarsePointer);
    const scaler = createQualityScaler(engine, startLevel, options.pinnedQuality !== null, (level) => {
      lighting.applyQuality(level);
      backdrop.applyQuality(level);
      post.applyQuality(level);
      canvas.dataset.quality = level.id;
    });
    canvas.dataset.backend = backend;
    // A lost graphics context (a phone running short of GPU memory) also blanks the canvas; count it for DevTools.
    canvas.dataset.contextLost = '0';
    canvas.addEventListener('webglcontextlost', () => {
      canvas.dataset.contextLost = String(Number(canvas.dataset.contextLost ?? '0') + 1);
    });

    // Compile every shader now (also those of props that stay hidden at first), not on the first scene change.
    await warmUpScene(scene);
    checkAborted();
    await scene.whenReadyAsync();
    checkAborted();
    options.onProgress(1);

    const canDraw = createRenderGuard(scene);
    let timeMs = 0;
    let fpsWindowMs = 0;
    const renderFrame = (): void => {
      const deltaMs = engine.getDeltaTime();
      timeMs += deltaMs;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      // The share shot holds the camera while it renders; otherwise the framing follows the window and the mode.
      if (!stage.capturing) post.focusAt(view.update(height > 0 ? width / height : 1, sway.update(deltaMs), timeMs));
      sky.fit(height > 0 ? width / height : 1);
      lighting.update(deltaMs);
      pulse.update(deltaMs);
      stage.update(deltaMs);
      // While a shader is still compiling the last picture stays up instead of a half-built (blank) frame.
      if (canDraw()) scene.render();
      scaler.onFrame(deltaMs);
      fpsWindowMs += deltaMs;
      if (fpsWindowMs >= 1000) {
        fpsWindowMs = 0;
        canvas.dataset.fps = engine.getFps().toFixed(0);
      }
    };
    // A hidden tab stops drawing entirely (and the frame-time average ignores the gap when it comes back).
    const syncVisibility = (): void => {
      engine.stopRenderLoop(renderFrame);
      if (!document.hidden) engine.runRenderLoop(renderFrame);
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    const resize = new ResizeObserver(() => engine.resize());
    resize.observe(host);
    const onWindowResize = (): void => scaler.refreshPixelRatio();
    window.addEventListener('resize', onWindowResize);
    cleanups.push(() => {
      engine.stopRenderLoop();
      document.removeEventListener('visibilitychange', syncVisibility);
      resize.disconnect();
      window.removeEventListener('resize', onWindowResize);
    });

    const world: BabylonWorld = {
      backend,
      get lightingPreset() {
        return lighting.preset;
      },
      setLightingPreset: (id) => lighting.setPreset(id),
      pulse: (prop) => pulse.start(prop),
      setFocus: (prop) => picking.setFocus(prop),
      setInputEnabled: (enabled) => picking.setEnabled(enabled),
      isViewChanged: () => sway.viewChanged,
      adjustView: (change) => {
        if (change === 'reset') sway.resetView();
        else sway.zoomBy(change === 'in' ? 0.8 : 1.25);
      },
      pickPropAt: (x, y) => picking.pickPropAt(x, y),
      stage,
      dispose: disposeAll,
    };
    return { kind: 'ready', world };
  } catch (error) {
    disposeAll();
    throw error;
  }
}

export const isBootAborted = (error: unknown): boolean => error instanceof BootAborted;
