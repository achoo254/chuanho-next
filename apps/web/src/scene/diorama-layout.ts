/**
 * Where everything stands in the yard, as data. The camera looks from the front (−z) towards the main hall (+z).
 * Tappable props stay near the middle so a tall phone, which crops the sides a little, still shows them all.
 *
 * Each placement names a kit asset; the asset comes from `public/models/<file>.glb` when that file exists and from
 * the primitive placeholder otherwise, so models can replace placeholders one at a time without touching this file.
 */
import type { DioramaExtent, Vec3 } from './fit-diorama-camera';
import type { InteractivePropId } from './world-actions';

export const PROP_ASSETS = [
  'plinth',
  'pavingStone',
  'templeHall',
  'bodhiTree',
  'bellTower',
  'lantern',
  'censer',
  'sutraShelf',
  'bell',
  'bowl',
  'woodenBoard',
  'mo',
  'character',
] as const;
export type PropAssetId = (typeof PROP_ASSETS)[number];

/** The model file each asset is looked up as, under `/models/`. */
export const PROP_ASSET_FILES: Readonly<Record<PropAssetId, string>> = {
  plinth: 'plinth.glb',
  pavingStone: 'paving-stone.glb',
  templeHall: 'temple-hall.glb',
  bodhiTree: 'bodhi-tree.glb',
  bellTower: 'bell-tower.glb',
  lantern: 'lantern.glb',
  censer: 'censer.glb',
  sutraShelf: 'sutra-shelf.glb',
  bell: 'bell.glb',
  bowl: 'bowl.glb',
  woodenBoard: 'wooden-board.glb',
  mo: 'mo.glb',
  character: 'character.glb',
};

export interface PropPlacement {
  readonly asset: PropAssetId;
  readonly position: readonly [number, number, number];
  readonly rotationY?: number;
  readonly scale?: number;
  /** Set for the props the player can tap. */
  readonly interactive?: InteractivePropId;
  /** Scenery that should not cast a shadow (the ground itself). */
  readonly noShadow?: boolean;
}

const PAVING: PropPlacement[] = [];
for (const x of [-2.7, -0.9, 0.9, 2.7]) {
  for (const z of [-5.4, -3.6, -1.8, 0, 1.8]) PAVING.push({ asset: 'pavingStone', position: [x, 0, z], noShadow: true });
}

export const DIORAMA_LAYOUT: readonly PropPlacement[] = [
  { asset: 'plinth', position: [0, 0, 0], noShadow: true },
  ...PAVING,
  { asset: 'templeHall', position: [0, 0, 4.1] },
  { asset: 'bodhiTree', position: [-6.1, 0, 1.6] },
  { asset: 'bodhiTree', position: [6.5, 0, -3.6], rotationY: 1.2, scale: 0.75 },
  { asset: 'bellTower', position: [6.0, 0, 2.3], rotationY: -0.3 },
  { asset: 'lantern', position: [-2.3, 0, 1.4] },
  { asset: 'lantern', position: [2.3, 0, 1.4], rotationY: Math.PI },
  { asset: 'lantern', position: [-5.0, 0, -2.2] },
  { asset: 'lantern', position: [5.0, 0, -1.2], rotationY: Math.PI },
  { asset: 'lantern', position: [-4.9, 0, 4.4] },
  { asset: 'lantern', position: [4.9, 0, 4.4], rotationY: Math.PI },
  { asset: 'censer', position: [0, 0, 0.5], interactive: 'censer' },
  { asset: 'sutraShelf', position: [-2.9, 0, -0.7], rotationY: 0.35, interactive: 'sutraShelf' },
  { asset: 'bell', position: [2.7, 0, -0.5], rotationY: -0.3, interactive: 'bell' },
  { asset: 'bowl', position: [3.3, 0, -2.2], interactive: 'bowl' },
  { asset: 'woodenBoard', position: [-3.4, 0, -3.3], rotationY: 0.4, interactive: 'woodenBoard' },
  { asset: 'mo', position: [0.9, 0, -2.7], rotationY: -0.4, interactive: 'mo' },
];

/** Where the character stands, facing the wooden fish (the gameplay places the real character here). */
export const CHARACTER_SPOT = { position: [-0.35, 0, -2.9] as const, rotationY: 0.5 };

/** The point the camera frames and the yard's size around it. */
export const CAMERA_TARGET: Vec3 = { x: 0, y: 1.5, z: 0.6 };
/** The plinth is 19 × 15.5 and the hall's ridge stands about 6.4 high. */
export const DIORAMA_EXTENT: DioramaExtent = { halfWidth: 9.5, halfDepth: 7.8, height: 7.2 };
