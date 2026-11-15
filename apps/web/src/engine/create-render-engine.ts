/**
 * Picks the render backend: WebGPU where the browser offers a working adapter, WebGL2 otherwise. Without WebGL2 the
 * game cannot run and the caller shows the still picture instead (there is no separate 2D game to fall back to).
 *
 * A canvas keeps the first kind of context it hands out, so a WebGPU attempt that fails part-way gets its canvas
 * thrown away and WebGL2 starts on a fresh one from `makeCanvas`.
 */
import { Engine } from '@babylonjs/core/Engines/engine';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import type { RendererPreference } from './game-3d-flag';

export type RenderBackend = 'webgpu' | 'webgl2';

export interface RenderEngine {
  readonly engine: AbstractEngine;
  readonly backend: RenderBackend;
  readonly canvas: HTMLCanvasElement;
}

/** The stencil buffer is needed by the hover glow; anti-aliasing is done in post-processing. */
const OPTIONS = { antialias: false, stencil: true, powerPreference: 'high-performance', adaptToDeviceRatio: false } as const;

async function tryWebGpu(makeCanvas: () => HTMLCanvasElement): Promise<RenderEngine | null> {
  if (!('gpu' in navigator)) return null;
  if (!(await WebGPUEngine.IsSupportedAsync)) return null;
  const canvas = makeCanvas();
  const engine = new WebGPUEngine(canvas, { ...OPTIONS });
  try {
    await engine.initAsync();
    return { engine, backend: 'webgpu', canvas };
  } catch (error) {
    console.warn('WebGPU could not start; trying WebGL2', error);
    engine.dispose();
    canvas.remove();
    return null;
  }
}

/** A throwaway probe, so a missing WebGL2 never leaves a half-made engine behind. */
function webGl2Available(): boolean {
  try {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return context !== null;
  } catch {
    return false;
  }
}

function tryWebGl2(makeCanvas: () => HTMLCanvasElement): RenderEngine | null {
  if (!webGl2Available()) return null;
  const canvas = makeCanvas();
  try {
    const engine = new Engine(canvas, OPTIONS.antialias, { ...OPTIONS, disableWebGL2Support: false }, OPTIONS.adaptToDeviceRatio);
    if (engine.webGLVersion < 2) {
      engine.dispose();
      canvas.remove();
      return null;
    }
    return { engine, backend: 'webgl2', canvas };
  } catch (error) {
    console.warn('WebGL2 could not start', error);
    canvas.remove();
    return null;
  }
}

/** The best engine this browser can run, or null when neither WebGPU nor WebGL2 works. */
export async function createRenderEngine(makeCanvas: () => HTMLCanvasElement, preference: RendererPreference): Promise<RenderEngine | null> {
  if (preference === 'auto') {
    const webGpu = await tryWebGpu(makeCanvas).catch((error: unknown) => {
      console.warn('WebGPU probe failed', error);
      return null;
    });
    if (webGpu) return webGpu;
  }
  return tryWebGl2(makeCanvas);
}
