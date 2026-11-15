/**
 * Compiles every shader the game will need behind the loading screen, so nothing compiles in the middle of play.
 * Props that stay hidden at the start (the character's mallet, beads, book and incense, dust puffs, note orbs, the
 * face's other eyes and mouths) are not drawn by the first frames, so their shaders used to compile the first time a
 * scene change showed them. On phones that stalled the frame and left the canvas blank for a moment. Also asks each
 * shadow generator to compile for everything it can cast.
 *
 * Also exports a small render guard: while the scene reports it is not ready (a shader still compiling), the loop
 * keeps the last picture on screen instead of drawing a half-built frame, for at most `MAX_HELD_FRAMES` in a row.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** Beyond this many held frames in a row (about a quarter second) the frame is drawn anyway. */
const MAX_HELD_FRAMES = 15;

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

/** Decides each frame whether to draw: false while a shader is still compiling, with a cap so it never sticks. */
export function createRenderGuard(scene: Scene): () => boolean {
  let held = 0;
  return () => {
    if (scene.isReady()) {
      held = 0;
      return true;
    }
    held += 1;
    if (held > MAX_HELD_FRAMES) {
      held = 0;
      return true;
    }
    return false;
  };
}
