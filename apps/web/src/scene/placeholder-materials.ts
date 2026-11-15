/**
 * The soft vinyl look of the code-built kit: one PBR material per surface (matte plastic, low metal), shared by
 * every part that uses it. Colours come from tokens.css; roof tiles, paving, red lacquer, leaves and wood also wear
 * the AI-made tiling textures from `/art/textures/` (repeated per part, so the seams stay small). The lantern body
 * glows; its strength follows the time-of-day look.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { Scene } from '@babylonjs/core/scene';
import { tokenLinearColor3 } from './token-colours';

interface Surface {
  readonly token: string;
  readonly roughness: number;
  readonly metallic?: number;
  /** A tiling texture under `/art/textures/` (its colour replaces the token's). */
  readonly texture?: string;
  /** Repeats of the texture across one part. */
  readonly tile?: number;
  /** Darkens a textured surface (the shaded side of the leaves, the darker stone). */
  readonly shade?: number;
}

const SURFACES = {
  plinth: { token: '--c-scene-plinth', roughness: 0.8 },
  stone: { token: '--c-scene-stone', roughness: 0.9, texture: 'da-lat', tile: 1 },
  stoneDark: { token: '--c-scene-stone-dark', roughness: 0.9, texture: 'da-lat', tile: 3, shade: 0.8 },
  roof: { token: '--c-scene-roof', roughness: 0.55, texture: 'ngoi', tile: 3 },
  lacquer: { token: '--c-scene-lacquer', roughness: 0.35, texture: 'son-do', tile: 1 },
  wall: { token: '--c-scene-wall', roughness: 0.75 },
  wood: { token: '--c-scene-wood', roughness: 0.7, texture: 'van-go', tile: 1 },
  lantern: { token: '--c-scene-lantern', roughness: 0.5 },
  bronze: { token: '--c-bronze', roughness: 0.35, metallic: 0.55 },
  gold: { token: '--c-primary-solid', roughness: 0.35, metallic: 0.5 },
  leaf: { token: '--c-leaf', roughness: 0.75, texture: 'la-bo-de', tile: 2 },
  leafDeep: { token: '--c-leaf-deep', roughness: 0.75, texture: 'la-bo-de', tile: 2, shade: 0.7 },
  trunk: { token: '--c-trunk', roughness: 0.85, texture: 'van-go', tile: 1 },
  vinyl: { token: '--c-scene-vinyl', roughness: 0.45 },
  blush: { token: '--c-scene-blush', roughness: 0.6 },
  ink: { token: '--c-scene-ink', roughness: 0.3 },
  mo: { token: '--c-scene-mo', roughness: 0.45 },
  book: { token: '--c-scene-book', roughness: 0.7 },
  cream: { token: '--c-scene-mallet-head', roughness: 0.8 },
  incense: { token: '--c-incense-body', roughness: 0.85 },
  moMouth: { token: '--c-scene-mo-mouth', roughness: 0.9 },
  /** White-ish vinyl for parts coloured per vertex (the lotus stand's petal gradient). */
  tinted: { token: '--c-scene-vinyl', roughness: 0.5 },
} as const satisfies Record<string, Surface>;

export type SurfaceName = keyof typeof SURFACES;

export interface MaterialPalette {
  get(surface: SurfaceName): PBRMaterial;
  /** Sets how brightly the lanterns burn (0 = unlit). */
  setLanternGlow(strength: number): void;
  dispose(): void;
}

export function createMaterialPalette(scene: Scene): MaterialPalette {
  const materials = new Map<SurfaceName, PBRMaterial>();
  const textures = new Map<string, Texture>();
  const textureFor = (file: string, tile: number): Texture => {
    const key = `${file}@${tile}`;
    const known = textures.get(key);
    if (known) return known;
    const texture = new Texture(`/art/textures/${file}.webp`, scene);
    texture.uScale = tile;
    texture.vScale = tile;
    textures.set(key, texture);
    return texture;
  };
  for (const [name, surface] of Object.entries(SURFACES) as Array<[SurfaceName, Surface]>) {
    const material = new PBRMaterial(`kit-${name}`, scene);
    if (surface.texture) {
      material.albedoTexture = textureFor(surface.texture, surface.tile ?? 1);
      material.albedoColor = Color3.White().scale(surface.shade ?? 1);
    } else {
      material.albedoColor = tokenLinearColor3(surface.token);
    }
    material.metallic = surface.metallic ?? 0;
    material.roughness = surface.roughness;
    materials.set(name, material);
  }
  const lantern = materials.get('lantern');
  // Red paper lit from inside: it glows in its own colour, faintly at sunset and brightly at night.
  if (lantern) lantern.emissiveColor = tokenLinearColor3('--c-scene-lantern');

  return {
    get(surface) {
      const material = materials.get(surface);
      if (!material) throw new Error(`No kit material ${surface}`);
      return material;
    },
    setLanternGlow(strength) {
      if (lantern) lantern.emissiveIntensity = Math.max(0, strength);
    },
    dispose() {
      for (const material of materials.values()) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      materials.clear();
      textures.clear();
    },
  };
}
