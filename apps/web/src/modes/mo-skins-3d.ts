/**
 * Wooden fish skins in 3D: the same wooden fish (model or placeholder) with another finish. The default keeps its
 * own materials; the others tint copies of them (glossy red lacquer, gilded), so a textured model keeps its carving
 * under the new colour. Skins unlock with merit exactly as before (player-progress.ts); only the look is new here.
 */
import type { Material } from '@babylonjs/core/Materials/material';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { MoSkinId } from '../game/player-progress';
import { tokenLinearColor3 } from '../scene/token-colours';

interface SkinFinish {
  readonly token: string;
  readonly roughness: number;
  readonly metallic: number;
}

const FINISHES: Readonly<Partial<Record<MoSkinId, SkinFinish>>> = {
  carved: { token: '--c-scene-lacquer', roughness: 0.25, metallic: 0.05 },
  fish: { token: '--c-primary-solid', roughness: 0.3, metallic: 0.65 },
};

export interface MoSkins {
  apply(skin: MoSkinId): void;
  dispose(): void;
}

/** `keep` lists meshes that never change finish (the dark mouth hollow). */
export function createMoSkins(mo: TransformNode, keep: readonly AbstractMesh[]): MoSkins {
  const meshes = [mo, ...mo.getChildMeshes(false)].filter((node): node is AbstractMesh => node instanceof AbstractMesh && !keep.includes(node));
  const originals = new Map<AbstractMesh, Material | null>(meshes.map((mesh) => [mesh, mesh.material]));
  const made: Material[] = [];
  const tinted = new Map<string, Material>();

  const tint = (material: Material, skin: MoSkinId, finish: SkinFinish): Material => {
    const key = `${skin}/${material.uniqueId}`;
    const cached = tinted.get(key);
    if (cached) return cached;
    let result: Material = material;
    if (material instanceof MultiMaterial) {
      const copy = new MultiMaterial(`${material.name}-${skin}`, material.getScene());
      copy.subMaterials = material.subMaterials.map((sub) => (sub ? tint(sub, skin, finish) : sub));
      result = copy;
    } else if (material instanceof PBRMaterial) {
      const copy = material.clone(`${material.name}-${skin}`);
      // A textured model keeps its carving under a brightened tint; a plain colour simply takes the finish's colour.
      copy.albedoColor = tokenLinearColor3(finish.token).scale(copy.albedoTexture ? 1.6 : 1);
      copy.roughness = finish.roughness;
      copy.metallic = finish.metallic;
      result = copy;
    }
    if (result !== material) made.push(result);
    tinted.set(key, result);
    return result;
  };

  return {
    apply(skin) {
      const finish = FINISHES[skin];
      for (const [mesh, original] of originals) mesh.material = finish && original ? tint(original, skin, finish) : original;
    },
    dispose() {
      for (const [mesh, original] of originals) mesh.material = original;
      for (const material of made) material.dispose();
    },
  };
}
