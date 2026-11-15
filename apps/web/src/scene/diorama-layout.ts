/**
 * Where everything stands in the yard, as data. The camera looks from the front (−z) towards the main hall (+z).
 * Tappable props stay near the middle so a tall phone, which crops the sides a little, still shows them all.
 *
 * Each placement names a kit asset; the asset comes from `public/models/<file>.glb` when that file exists and from
 * the primitive placeholder otherwise, so models can replace placeholders one at a time without touching this file.
 * File names follow the model kit (Vietnamese names); a model is scaled to its placeholder's height on load.
 */
import type { DecorationId } from '../game/player-progress';
import type { DioramaExtent, Vec3 } from './fit-diorama-camera';
import type { InteractivePropId } from './world-actions';

export const PROP_ASSETS = [
  'plinth',
  'pavingStone',
  'templeHall',
  'pillar',
  'bodhiTree',
  'bellTower',
  'lantern',
  'censer',
  'sutraShelf',
  'bell',
  'bowl',
  'woodenBoard',
  'mo',
  'lotusStand',
  'mallet',
] as const;
export type PropAssetId = (typeof PROP_ASSETS)[number];

/**
 * The model file each asset is looked up as, under `/models/`; null keeps the code-built version. Only the kit's
 * models that came out well are listed (`public/models/CREDITS.md`); the rest (hall, bell tower, trees, lanterns,
 * censer, sutra stand, lotus stand) are built in code with tiling textures, because their generated models were
 * misshapen. Give an asset its file name once a good model exists and the file wins.
 */
export const PROP_ASSET_FILES: Readonly<Record<PropAssetId, string | null>> = {
  plinth: null,
  pavingStone: null,
  templeHall: null,
  pillar: 'cot-son.glb',
  bodhiTree: null,
  bellTower: null,
  lantern: null,
  censer: null,
  sutraShelf: null,
  bell: 'chuong.glb',
  bowl: 'bat.glb',
  woodenBoard: null,
  mo: 'mo.glb',
  lotusStand: null,
  mallet: 'dui.glb',
};

/**
 * How a model is set into the kit's convention (standing on y = 0, front towards −z, mallet head up): a turn, a tip,
 * and the size to fit. Without an entry a model keeps its orientation and is scaled to its placeholder's height.
 */
export interface ModelFit {
  /** Turn about the vertical, radians, applied before fitting. */
  readonly yaw?: number;
  /** Tip about the side axis, radians (a model lying down stands up). */
  readonly pitch?: number;
  /** Target height; defaults to the placeholder's height. */
  readonly height?: number;
  /** Target for the largest side instead of the height (long, thin things). */
  readonly largest?: number;
}

export const PROP_MODEL_FITS: Readonly<Partial<Record<PropAssetId, ModelFit>>> = {
  // The wooden fish was generated with its mouth towards +z.
  mo: { yaw: Math.PI },
  // The mallet lies along z with its head at −z: tip it upright, head up, and size it by its length.
  mallet: { pitch: Math.PI / 2, largest: 0.68 },
  // The bell model is the bell alone (the placeholder includes a tall frame).
  bell: { height: 1.0 },
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
  /** Yard decorations bought with merit: hidden until unlocked. */
  readonly decoration?: DecorationId;
}

const PAVING: PropPlacement[] = [];
for (const x of [-2.7, -0.9, 0.9, 2.7]) {
  for (const z of [-5.4, -3.6, -1.8, 0, 1.8]) PAVING.push({ asset: 'pavingStone', position: [x, 0, z], noShadow: true });
}

/** The wooden fish rests on its lotus stand here (the stand's top decides its height at run time). */
export const MO_STAND_SPOT = { position: [0.78, 0, -3.2] as const, rotationY: -0.35 };

export const DIORAMA_LAYOUT: readonly PropPlacement[] = [
  { asset: 'plinth', position: [0, 0, 0], noShadow: true },
  ...PAVING,
  { asset: 'templeHall', position: [0, 0, 4.1] },
  // The hall's front pillars stand on its platform (0.6 high).
  ...[-3.8, -1.4, 1.4, 3.8].map((x): PropPlacement => ({ asset: 'pillar', position: [x, 0.6, 2.2] })),
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
  { asset: 'mo', position: [MO_STAND_SPOT.position[0], 0, MO_STAND_SPOT.position[2]], rotationY: MO_STAND_SPOT.rotationY, interactive: 'mo' },
  // Merit decorations: two lanterns by the front steps, a lotus by the path, a bodhi sapling by the bell.
  { asset: 'lantern', position: [-2.2, 0, -4.6], scale: 0.85, decoration: 'lanternLeft' },
  { asset: 'lantern', position: [2.6, 0, -4.4], rotationY: Math.PI, scale: 0.85, decoration: 'lanternRight' },
  { asset: 'lotusStand', position: [-1.7, 0, -1.6], scale: 1.4, decoration: 'lotus' },
  { asset: 'bodhiTree', position: [1.9, 0, -1.4], rotationY: 0.6, scale: 0.3, decoration: 'bodhiSapling' },
];

/** Where the character stands: beside the wooden fish, turned a little towards it, facing the camera. */
export const CHARACTER_SPOT = { position: [-0.22, 0, -2.95] as const, rotationY: -0.3 };

/** The point the camera frames and the yard's size around it. */
export const CAMERA_TARGET: Vec3 = { x: 0, y: 1.5, z: 0.6 };
/** The plinth is 19 × 15.5 and the hall's ridge stands about 6.4 high. */
export const DIORAMA_EXTENT: DioramaExtent = { halfWidth: 9.5, halfDepth: 7.8, height: 7.2 };
