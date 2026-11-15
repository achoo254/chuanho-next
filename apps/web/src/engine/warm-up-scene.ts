/**
 * Compiles every shader the game will need behind the loading screen, so nothing compiles in the middle of play.
 * Props that stay hidden at the start (the character's mallet, beads, book and incense, dust puffs, note orbs, the
 * face's other eyes and mouths) are not drawn by the first frames, so their shaders used to compile the first time a
 * scene change showed them. On phones that stalled the frame and left the canvas blank for a moment. Also asks each
 * shadow generator to compile for everything it can cast.
 *
 * Also exports a small render guard for the moment right after a scene change (`arm()`): for a few frames, while the
 * scene reports it is not ready (a shader still compiling), the loop keeps the last picture on screen instead of drawing
 * a half-built frame. Once the scene is ready or `MAX_HELD_FRAMES` frames went by, the guard disarms and frames draw
 * as usual; a disarmed guard never asks the scene (`isReady()` walks every mesh, too costly for every frame).
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** An armed guard holds at most this many frames (about a third of a second) before drawing anyway. */
export const MAX_HELD_FRAMES = 20;

async function compileMeshMaterial(mesh: Mesh): Promise<void> {
  const material = mesh.material;
  if (!material) return;
  try {
    await material.forceCompilationAsync(mesh);
  } catch (error) {
    console.warn(`Shader warm-up failed for ${mesh.name}`, error);
  }
}

export async function warmUpScene(scene: Scene): Promise<void> {
  for (const mesh of scene.meshes) {
    // Instances share their source's material, so only real meshes need compiling.
    if ('subMeshes' in mesh && mesh.subMeshes?.length) await compileMeshMaterial(mesh as Mesh);
  }
  for (const light of scene.lights) {
    const generator = light.getShadowGenerator();
    if (!generator) continue;
    await new Promise<void>((resolve) => {
      generator.forceCompilationAsync().then(() => resolve(), (error: unknown) => {
        console.warn('Shadow warm-up failed', error);
        resolve();
      });
    });
  }
}

export interface RenderGuard {
  /** A scene change happened: guard the next frames until the scene is ready (at most MAX_HELD_FRAMES held). */
  arm(): void;
  /** Called each frame: false to keep the last picture this frame. */
  canDraw(): boolean;
}

/** `isReady` is the scene's readiness (scene.isReady in the app); only asked while armed. */
export function createRenderGuard(isReady: () => boolean): RenderGuard {
  let budget = 0;
  return {
    arm() {
      budget = MAX_HELD_FRAMES;
    },
    canDraw() {
      if (budget === 0) return true;
      if (isReady()) {
        budget = 0;
        return true;
      }
      budget -= 1;
      return false;
    },
  };
}
