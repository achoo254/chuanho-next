/**
 * Builds the yard from the layout: loads every kit asset once (model or placeholder, in parallel), places each copy,
 * tags the tappable props, and leaves empty anchors where the character and the wooden fish's strike point go.
 */
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { CHARACTER_SPOT, DIORAMA_LAYOUT, PROP_ASSETS, type PropAssetId } from './diorama-layout';
import type { MaterialPalette } from './placeholder-materials';
import { type PropPrototype, loadPropPrototype } from './prop-asset-library';
import type { InteractivePropId } from './world-actions';

/** What a tagged node carries in `metadata`, so a picked mesh can be traced back to its prop. */
export interface PropMetadata {
  readonly propId: InteractivePropId;
}

export interface Diorama {
  /** The root node of each tappable prop. */
  readonly props: ReadonlyMap<InteractivePropId, TransformNode>;
  /** Where the character stands; the placeholder chibi is its child. */
  readonly characterSpot: TransformNode;
  /** Every mesh that should cast a shadow. */
  readonly shadowCasters: readonly AbstractMesh[];
  /** How many assets came from real models rather than placeholders. */
  readonly modelCount: number;
  dispose(): void;
}

function meshesOf(node: TransformNode): AbstractMesh[] {
  const own = node instanceof AbstractMesh ? [node] : [];
  return [...own, ...node.getChildMeshes(false)];
}

export async function buildDiorama(
  scene: Scene,
  palette: MaterialPalette,
  signal: AbortSignal,
  onAssetLoaded: (done: number, total: number) => void,
): Promise<Diorama> {
  let done = 0;
  const prototypes = new Map<PropAssetId, PropPrototype>();
  await Promise.all(
    PROP_ASSETS.map(async (asset) => {
      prototypes.set(asset, await loadPropPrototype(scene, palette, asset, signal));
      done += 1;
      onAssetLoaded(done, PROP_ASSETS.length);
    }),
  );

  const prototypeOf = (asset: PropAssetId): PropPrototype => {
    const prototype = prototypes.get(asset);
    if (!prototype) throw new Error(`Asset ${asset} did not load`);
    return prototype;
  };

  const props = new Map<InteractivePropId, TransformNode>();
  const shadowCasters: AbstractMesh[] = [];
  DIORAMA_LAYOUT.forEach((placement, index) => {
    const node = prototypeOf(placement.asset).spawn(`${placement.asset}-${index}`);
    node.position.set(placement.position[0], placement.position[1], placement.position[2]);
    node.rotation.y = placement.rotationY ?? 0;
    node.scaling.setAll(placement.scale ?? 1);
    const meshes = meshesOf(node);
    for (const mesh of meshes) {
      mesh.receiveShadows = true;
      mesh.isPickable = placement.interactive !== undefined;
      if (!placement.noShadow) shadowCasters.push(mesh);
    }
    if (placement.interactive) {
      const metadata: PropMetadata = { propId: placement.interactive };
      node.metadata = metadata;
      props.set(placement.interactive, node);
    }
    // Scenery never moves: freezing its world matrix saves work every frame.
    if (!placement.interactive) for (const mesh of meshes) mesh.freezeWorldMatrix();
  });

  const characterSpot = new TransformNode('character-spot', scene);
  characterSpot.position.set(CHARACTER_SPOT.position[0], CHARACTER_SPOT.position[1], CHARACTER_SPOT.position[2]);
  characterSpot.rotation.y = CHARACTER_SPOT.rotationY;
  const character = prototypeOf('character').spawn('character');
  character.parent = characterSpot;
  for (const mesh of meshesOf(character)) {
    mesh.isPickable = false;
    shadowCasters.push(mesh);
  }

  const modelCount = [...prototypes.values()].filter((p) => p.source === 'model').length;
  return {
    props,
    characterSpot,
    shadowCasters,
    modelCount,
    dispose() {
      for (const prototype of prototypes.values()) prototype.dispose();
      characterSpot.dispose();
    },
  };
}

/** The tappable prop a picked mesh belongs to, found by walking up its parents. */
export function propOfNode(node: { metadata: unknown; parent: unknown } | null): InteractivePropId | null {
  let current: unknown = node;
  while (current && typeof current === 'object') {
    const { metadata, parent } = current as { metadata?: unknown; parent?: unknown };
    if (metadata && typeof metadata === 'object' && 'propId' in metadata) return (metadata as PropMetadata).propId;
    current = parent;
  }
  return null;
}
