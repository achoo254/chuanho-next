/**
 * Turns an asset name into something that can be placed in the yard: the AI-made model from `/models/<file>.glb`
 * when it exists, the primitive placeholder otherwise. Placing the same asset again reuses its geometry: placeholders
 * become GPU instances, models become clones sharing geometry and materials.
 */
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
// Side effect: lets meshes make GPU instances (the repeated paving stones, lanterns and trees).
import '@babylonjs/core/Meshes/instancedMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { PROP_ASSET_FILES, type PropAssetId } from './diorama-layout';
import { buildBellTower, buildBodhiTree, buildLantern, buildPavingStone, buildPlinth, buildTempleHall } from './placeholder-kit-architecture';
import { buildBell, buildBowl, buildCenser, buildCharacter, buildMo, buildSutraShelf, buildWoodenBoard } from './placeholder-kit-props';
import type { MaterialPalette } from './placeholder-materials';
import { PartBuilder } from './placeholder-shapes';

export interface PropPrototype {
  readonly source: 'model' | 'placeholder';
  /** A new copy of the asset in the scene, at the origin. */
  spawn(name: string): TransformNode;
  dispose(): void;
}

const PLACEHOLDERS: Readonly<Record<PropAssetId, (kit: PartBuilder) => Mesh>> = {
  plinth: buildPlinth,
  pavingStone: buildPavingStone,
  templeHall: buildTempleHall,
  bodhiTree: buildBodhiTree,
  bellTower: buildBellTower,
  lantern: buildLantern,
  censer: buildCenser,
  sutraShelf: buildSutraShelf,
  bell: buildBell,
  bowl: buildBowl,
  woodenBoard: buildWoodenBoard,
  mo: buildMo,
  character: buildCharacter,
};

function placeholderPrototype(scene: Scene, palette: MaterialPalette, asset: PropAssetId): PropPrototype {
  const mesh = PLACEHOLDERS[asset](new PartBuilder(scene, palette));
  let spawned = 0;
  return {
    source: 'placeholder',
    // The first copy is the mesh itself (so it can glow on hover); later copies are instances of it.
    spawn(name) {
      spawned += 1;
      if (spawned === 1) {
        mesh.name = name;
        return mesh;
      }
      return mesh.createInstance(name);
    },
    dispose() {
      mesh.dispose();
    },
  };
}

function modelPrototype(scene: Scene, container: AssetContainer): PropPrototype {
  const copies: TransformNode[] = [];
  return {
    source: 'model',
    spawn(name) {
      const entries = container.instantiateModelsToScene((sourceName) => `${name}/${sourceName}`, false, { doNotInstantiate: true });
      const root = new TransformNode(name, scene);
      for (const node of entries.rootNodes) node.parent = root;
      copies.push(root);
      return root;
    },
    dispose() {
      for (const copy of copies) copy.dispose(false, false);
      container.dispose();
    },
  };
}

let gltfLoader: Promise<unknown> | null = null;

/** The glTF loader (and its extensions, meshopt and KTX2 among them) loads with the first real model, not before. */
function loadGltfLoader(): Promise<unknown> {
  gltfLoader ??= Promise.all([import('@babylonjs/loaders/glTF/glTFFileLoader'), import('@babylonjs/loaders/glTF/2.0')]);
  return gltfLoader;
}

/** True when the bytes start with the binary glTF magic ("glTF"): a missing file comes back as the HTML page. */
function isBinaryGltf(bytes: Uint8Array): boolean {
  return bytes.length > 12 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
}

async function loadModel(scene: Scene, asset: PropAssetId, signal: AbortSignal): Promise<AssetContainer | null> {
  try {
    const response = await fetch(`/models/${PROP_ASSET_FILES[asset]}`, { signal });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isBinaryGltf(bytes)) return null;
    await loadGltfLoader();
    return await LoadAssetContainerAsync(bytes, scene, { pluginExtension: '.glb', name: asset });
  } catch (error) {
    if (signal.aborted) return null;
    console.warn(`Model for ${asset} could not load; using the placeholder`, error);
    return null;
  }
}

/** The model when there is one, the placeholder otherwise. Never rejects. */
export async function loadPropPrototype(scene: Scene, palette: MaterialPalette, asset: PropAssetId, signal: AbortSignal): Promise<PropPrototype> {
  const container = await loadModel(scene, asset, signal);
  return container ? modelPrototype(scene, container) : placeholderPrototype(scene, palette, asset);
}
