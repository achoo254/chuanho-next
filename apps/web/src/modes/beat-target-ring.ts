/**
 * The hit target of Mõ Beat: an AI-drawn halo of lotus buds and golden light standing behind the wooden fish like an
 * aureole, centred on its top where the notes land (`/art/beat/target-ring.webp`). It always faces the camera (a flat
 * ring on the ground reads as a thin smear at this camera's angle) and keeps the depth test, so the wooden fish stands
 * in front of its lower half. It breathes on every beat; a second copy closes in on it as the next note arrives, so
 * the moment to strike is easy to read; a third swells and fades as a ripple when a note is hit.
 */
import { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Point3 } from './note-orb-path';

const RING_URL = '/art/beat/target-ring.webp';
/** Diameter of the halo at rest, world units: a little wider than the wooden fish. */
const RING_SIZE = 0.66;
/** How far behind the landing point (away from the camera) the halo stands, so the wooden fish is in front of it. */
const RING_BEHIND = 0.3;
/** The halo's brightness at rest: below 1, so the bright daylight exposure keeps its pastel colours. */
const RING_GLOW = 0.95;

export interface TargetRingFrame {
  /** 0..1 beat pulse. */
  readonly pulse: number;
  /** The closing ring for the next note. */
  readonly approach: { readonly scale: number; readonly alpha: number };
  /** The ripple of the last hit. */
  readonly ripple: { readonly scale: number; readonly alpha: number };
}

export interface TargetRing {
  show(at: Point3 | null): void;
  update(frame: TargetRingFrame): void;
  dispose(): void;
}

interface RingPart {
  readonly mesh: Mesh;
  readonly material: StandardMaterial;
  readonly texture: Texture;
}

/**
 * One flat ring, unlit: the picture is the emissive texture (StandardMaterial adds it to the emissive colour, which
 * stays black) and its alpha the opacity. The texture's level is its brightness; above 1 it crosses the bloom
 * threshold. Each ring has its own texture object (the image is fetched once) so each can have its own brightness.
 */
function ringPart(scene: Scene, name: string, brightness: number): RingPart {
  const texture = new Texture(RING_URL, scene);
  texture.hasAlpha = true;
  texture.level = brightness;
  const material = new StandardMaterial(name, scene);
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.emissiveColor = Color3.Black();
  material.backFaceCulling = false;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.disableDepthWrite = true;
  const mesh = CreatePlane(name, { size: 1 }, scene);
  mesh.billboardMode = TransformNode.BILLBOARDMODE_ALL;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return { mesh, material, texture };
}

export function createTargetRing(scene: Scene): TargetRing {
  const base = ringPart(scene, 'beat-ring', RING_GLOW);
  const approach = ringPart(scene, 'beat-ring-approach', RING_GLOW);
  const ripple = ringPart(scene, 'beat-ring-ripple', 1.2);
  const parts = [base, approach, ripple];

  return {
    show(at) {
      for (const part of parts) {
        part.mesh.setEnabled(at !== null);
        if (at) part.mesh.position.set(at.x, at.y, at.z + RING_BEHIND);
      }
    },
    update({ pulse, approach: closing, ripple: wave }) {
      base.mesh.scaling.setAll(RING_SIZE * (1 + pulse * 0.07));
      // The halo flares on the beat (brighter than its rest level, into the bloom).
      base.texture.level = RING_GLOW + pulse * 0.45;
      base.material.alpha = 0.9 + pulse * 0.1;
      approach.mesh.scaling.setAll(RING_SIZE * closing.scale);
      approach.material.alpha = closing.alpha;
      approach.mesh.isVisible = closing.alpha > 0.01;
      ripple.mesh.scaling.setAll(RING_SIZE * wave.scale);
      ripple.material.alpha = wave.alpha;
      ripple.mesh.isVisible = wave.alpha > 0.01;
    },
    dispose() {
      for (const part of parts) {
        part.mesh.dispose();
        part.material.dispose();
        part.texture.dispose();
      }
    },
  };
}
