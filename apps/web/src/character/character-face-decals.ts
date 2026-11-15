/**
 * The face as three decals wrapped on the front of the skull: eyes, mouth and pink cheeks, each swapping between
 * the drawn shapes. Decal look: the drawing's own colours, shaded by the scene's light like the head (a small self-lit
 * share keeps pink cheeks from turning orange under a warm sunset), no shine, and pulled towards the camera so it never flickers.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateDecal } from '@babylonjs/core/Meshes/Builders/decalBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { FaceTextures } from './character-face-textures';
import { EYE_SHAPES, type EyeShape, type FaceParts, MOUTH_SHAPES, type MouthShape } from './face-expressions';

export interface FaceDecals {
  show(parts: FaceParts): void;
  dispose(): void;
}

function decalMaterial(scene: Scene, name: string, texture: BaseTexture, alpha = 1): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  // Mostly lit by the scene like the skull it sits on (a strongly self-lit face glowed at night while the head went dark);
  // the small self-lit share keeps the drawing readable in shade and the cheeks pink under warm light.
  material.emissiveColor = new Color3(0.14, 0.14, 0.14);
  material.diffuseColor = new Color3(0.9, 0.9, 0.9);
  material.specularColor = Color3.Black();
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = alpha;
  material.zOffset = -2;
  return material;
}

/**
 * Projects the decals while the skull still sits where it was built (`centre` is the skull's centre in world space
 * at that moment), then keeps them on the skull.
 */
export function buildFaceDecals(scene: Scene, skull: Mesh, centre: Vector3, radius: number, textures: FaceTextures): FaceDecals {
  skull.computeWorldMatrix(true);
  const outwards = new Vector3(0, 0.25, -1).normalize();
  const at = (up: number): Vector3 => centre.add(new Vector3(0, up, -radius));
  const blush = CreateDecal('face-blush', skull, { position: at(-0.12), normal: outwards, size: new Vector3(0.94, 0.47, 0.7) });
  const eyes = CreateDecal('face-eyes', skull, { position: at(0.03), normal: outwards, size: new Vector3(0.68, 0.34, 0.7) });
  const mouth = CreateDecal('face-mouth', skull, { position: at(-0.15), normal: outwards, size: new Vector3(0.25, 0.25, 0.7) });

  const eyeMaterials = new Map<EyeShape, StandardMaterial>(EYE_SHAPES.map((shape) => [shape, decalMaterial(scene, `eyes-${shape}`, textures.eyes[shape])]));
  const mouthMaterials = new Map<MouthShape, StandardMaterial>(MOUTH_SHAPES.map((shape) => [shape, decalMaterial(scene, `mouth-${shape}`, textures.mouths[shape])]));
  const blushMaterial = decalMaterial(scene, 'blush', textures.blush, 0.8);
  // All transparent, so draw order (not depth) decides what is on top: cheeks, then eyes and mouth.
  blush.alphaIndex = 1;
  eyes.alphaIndex = 2;
  mouth.alphaIndex = 2;
  for (const decal of [blush, eyes, mouth]) {
    decal.setParent(skull);
    decal.isPickable = false;
  }
  blush.material = blushMaterial;
  let shown: FaceParts | null = null;
  const show = (parts: FaceParts): void => {
    if (shown && shown.eyes === parts.eyes && shown.mouth === parts.mouth) return;
    shown = parts;
    eyes.material = eyeMaterials.get(parts.eyes) ?? null;
    mouth.material = mouthMaterials.get(parts.mouth) ?? null;
  };
  show({ eyes: 'open', mouth: 'smile' });
  return {
    show,
    dispose() {
      for (const material of [...eyeMaterials.values(), ...mouthMaterials.values(), blushMaterial]) material.dispose();
    },
  };
}
