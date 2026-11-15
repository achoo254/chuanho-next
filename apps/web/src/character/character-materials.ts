/**
 * The character's surfaces: soft vinyl skin with a faint clear-coat shine (the blind-box toy look), a matte cotton
 * robe with a soft sheen at its edges and the AI-drawn patchwork, a deeper robe colour for collar, cuffs and
 * trousers, slippers, the incense marks, wooden beads and the meditation cushion. Colours come from tokens.css.
 */
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { tokenLinearColor3 } from '../scene/token-colours';

export interface CharacterMaterials {
  readonly skin: PBRMaterial;
  readonly robe: PBRMaterial;
  readonly robeDark: PBRMaterial;
  readonly shoe: PBRMaterial;
  readonly mark: PBRMaterial;
  readonly bead: PBRMaterial;
  readonly cushion: PBRMaterial;
  dispose(): void;
}

function vinyl(scene: Scene, name: string, token: string, roughness: number, coat: number): PBRMaterial {
  const material = new PBRMaterial(`character-${name}`, scene);
  material.albedoColor = tokenLinearColor3(token);
  material.metallic = 0;
  material.roughness = roughness;
  if (coat > 0) {
    material.clearCoat.isEnabled = true;
    material.clearCoat.intensity = coat;
    material.clearCoat.roughness = 0.3;
  }
  return material;
}

function cloth(scene: Scene, name: string, token: string, fabric: Texture | null, tile: number): PBRMaterial {
  const material = vinyl(scene, name, token, 0.85, 0);
  // Cotton catches a soft light at its edges instead of a plastic highlight.
  material.sheen.isEnabled = true;
  material.sheen.intensity = 0.35;
  material.sheen.color = tokenLinearColor3('--c-scene-char-skin');
  if (fabric) {
    const texture = fabric.clone();
    texture.uScale = tile;
    texture.vScale = tile * 0.5;
    material.albedoTexture = texture;
  }
  return material;
}

export function createCharacterMaterials(scene: Scene, fabric: Texture | null): CharacterMaterials {
  const all = {
    skin: vinyl(scene, 'skin', '--c-scene-char-skin', 0.6, 0.22),
    robe: cloth(scene, 'robe', '--c-scene-char-robe', fabric, 3),
    robeDark: cloth(scene, 'robe-dark', '--c-scene-char-robe-dark', null, 1),
    shoe: vinyl(scene, 'shoe', '--c-scene-char-shoe', 0.55, 0.25),
    mark: vinyl(scene, 'mark', '--c-scene-char-mark', 0.8, 0),
    bead: vinyl(scene, 'bead', '--c-scene-char-bead', 0.5, 0),
    cushion: cloth(scene, 'cushion', '--c-scene-char-cushion', fabric, 1),
  };
  return {
    ...all,
    dispose() {
      for (const material of Object.values(all)) {
        material.albedoTexture?.dispose();
        material.dispose();
      }
    },
  };
}
