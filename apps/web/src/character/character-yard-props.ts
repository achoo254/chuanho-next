/**
 * The character's own things in the yard: the round meditation cushion on its spot, and a soft contact shadow that
 * follows its feet (it keeps the character grounded on low quality, where real shadows are off).
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Material } from '@babylonjs/core/Materials/material';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

/** A plump round cushion with a rolled rim, standing at a floor point. */
export function buildMeditationCushion(scene: Scene, x: number, z: number, cloth: Material): Mesh {
  const base = CreateCylinder('cushion-base', { height: 0.12, diameter: 1.02, tessellation: 32 }, scene);
  base.position.y = 0.07;
  const rim = CreateTorus('cushion-rim', { diameter: 0.94, thickness: 0.15, tessellation: 32 }, scene);
  rim.position.y = 0.09;
  const merged = Mesh.MergeMeshes([base, rim], true, true);
  if (!merged) throw new Error('Cushion has no parts');
  merged.name = 'meditation-cushion';
  merged.material = cloth;
  merged.position.set(x, 0, z);
  merged.isPickable = false;
  merged.receiveShadows = true;
  return merged;
}

/** A soft dark ellipse on the floor under the character, fading out to the edge. */
export function buildContactShadow(scene: Scene, parent: TransformNode): { mesh: Mesh; dispose(): void } {
  const size = 128;
  const texture = new DynamicTexture('character-contact-shadow', { width: size, height: size }, scene, true);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  const colour = getComputedStyle(document.documentElement).getPropertyValue('--c-scene-char-shadow').trim();
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, colour);
  gradient.addColorStop(0.55, colour);
  gradient.addColorStop(1, 'transparent');
  ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.update();
  const material = new StandardMaterial('character-contact-shadow', scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.disableLighting = true;
  material.emissiveColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.zOffset = -4;
  const mesh = CreateGround('character-contact-shadow', { width: 1.1, height: 0.95 }, scene);
  mesh.material = material;
  mesh.parent = parent;
  mesh.position.y = 0.015;
  mesh.isPickable = false;
  return {
    mesh,
    dispose() {
      mesh.dispose();
      texture.dispose();
      material.dispose();
    },
  };
}
