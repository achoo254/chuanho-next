/**
 * The backdrop behind the diorama: a large inside-out sphere painted with a vertical gradient through
 * vertex colours, so a time-of-day change only rewrites a small colour buffer. Unlit and fog-free.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Scene } from '@babylonjs/core/scene';
import type { Rgb } from './lighting-presets';

const RADIUS = 80;

export interface SkyDome {
  readonly mesh: Mesh;
  paint(top: Rgb, horizon: Rgb): void;
  dispose(): void;
}

export function createSkyDome(scene: Scene): SkyDome {
  const mesh = CreateSphere('sky', { diameter: RADIUS * 2, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  mesh.isPickable = false;
  mesh.infiniteDistance = true;
  mesh.applyFog = false;
  const material = new StandardMaterial('sky', scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.emissiveColor = Color3.White();
  material.fogEnabled = false;
  mesh.material = material;

  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const count = positions.length / 3;
  const colours = new Float32Array(count * 4);
  // Height of each vertex, −1 (nadir) to 1 (zenith).
  const heights = new Float32Array(count);
  for (let i = 0; i < count; i += 1) heights[i] = (positions[i * 3 + 1] ?? 0) / RADIUS;

  return {
    mesh,
    paint(top, horizon) {
      for (let i = 0; i < count; i += 1) {
        // The camera looks down on the diorama, so it sees the lower half of the dome: the gradient runs from the
        // warm colour straight below up to the deep colour just under the horizon, i.e. bottom to top of the screen.
        const t = Math.min(1, Math.max(0, ((heights[i] ?? 0) + 1) / 0.8));
        colours[i * 4] = horizon[0] + (top[0] - horizon[0]) * t;
        colours[i * 4 + 1] = horizon[1] + (top[1] - horizon[1]) * t;
        colours[i * 4 + 2] = horizon[2] + (top[2] - horizon[2]) * t;
        colours[i * 4 + 3] = 1;
      }
      if (mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) mesh.updateVerticesData(VertexBuffer.ColorKind, colours);
      else mesh.setVerticesData(VertexBuffer.ColorKind, colours, true);
    },
    dispose() {
      material.dispose();
      mesh.dispose();
    },
  };
}
