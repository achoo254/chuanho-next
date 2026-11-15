/**
 * The soft vinyl look of the placeholder kit: one PBR material per surface (matte plastic, low metal), shared by
 * every placeholder that uses it. Colours come from tokens.css. The lantern body glows; its strength follows the
 * time-of-day look.
 */
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { tokenLinearColor3 } from './token-colours';

interface Surface {
  readonly token: string;
  readonly roughness: number;
  readonly metallic?: number;
}

const SURFACES = {
  plinth: { token: '--c-scene-plinth', roughness: 0.8 },
  stone: { token: '--c-scene-stone', roughness: 0.9 },
  stoneDark: { token: '--c-scene-stone-dark', roughness: 0.9 },
  roof: { token: '--c-scene-roof', roughness: 0.55 },
  lacquer: { token: '--c-scene-lacquer', roughness: 0.4 },
  wall: { token: '--c-scene-wall', roughness: 0.75 },
  wood: { token: '--c-scene-wood', roughness: 0.7 },
  lantern: { token: '--c-scene-lantern', roughness: 0.5 },
  bronze: { token: '--c-bronze', roughness: 0.35, metallic: 0.55 },
  gold: { token: '--c-primary-solid', roughness: 0.35, metallic: 0.5 },
  leaf: { token: '--c-leaf', roughness: 0.75 },
  leafDeep: { token: '--c-leaf-deep', roughness: 0.75 },
  trunk: { token: '--c-trunk', roughness: 0.85 },
  vinyl: { token: '--c-scene-vinyl', roughness: 0.45 },
  blush: { token: '--c-scene-blush', roughness: 0.6 },
  ink: { token: '--c-scene-ink', roughness: 0.3 },
  mo: { token: '--c-scene-mo', roughness: 0.45 },
  book: { token: '--c-scene-book', roughness: 0.7 },
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
  for (const [name, surface] of Object.entries(SURFACES) as Array<[SurfaceName, Surface]>) {
    const material = new PBRMaterial(`kit-${name}`, scene);
    material.albedoColor = tokenLinearColor3(surface.token);
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
      materials.clear();
    },
  };
}
