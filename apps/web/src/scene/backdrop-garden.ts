/**
 * The garden around the plinth, replacing the old stretched meadow picture: a lawn wearing a small seamless AI-painted
 * grass tile (about 5 units per repeat, so it stays crisp) with slow light-and-shade baked into its vertex colours,
 * two lotus ponds and a stream with shimmering water, sandy banks and pebbles, stepping stones, lily pads and lotus
 * flowers, bamboo clumps, puffy mint and blossom trees, flowering bushes, little flowers and a ring of far hills.
 *
 * Every repeated piece is one mesh drawn with thin instances (one draw call each), and all set pieces share one
 * vertex-coloured vinyl material, so the time-of-day tint is three colour writes. The quality ladder's lowest rung
 * drops the little flowers.
 */
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { QualityLevel } from '../engine/quality-levels';
import {
  BAMBOO_CLUMPS,
  BLOSSOM_TREES,
  GROUND_Y,
  HILL_RING,
  PLINTH_CLEAR,
  PONDS,
  PUFFY_TREES,
  type Placement,
  STEPPING_STONES,
  STREAM_HALF_WIDTH,
  STREAM_PATH,
  lawnVariation,
  offsetPolyline,
  onWater,
  pointsInside,
  rimPoints,
  scatter,
  scatterClusters,
  seededRandom,
} from './backdrop-layout';
import {
  buildBambooClump,
  buildBush,
  buildHill,
  buildLilyPad,
  buildLittleFlower,
  buildLotusFlower,
  buildPebble,
  buildPuffyTree,
  buildSteppingStone,
} from './backdrop-shapes';
import { buildEllipse, buildStrip, createGardenWater } from './backdrop-water';
import type { Rgb } from './lighting-presets';
import { tokenLinearColor3 } from './token-colours';

const GRASS_URL = '/art/backdrop/grass.webp';
/** World size of one repeat of the grass tile. */
const GRASS_TILE = 5;
const LAWN_SIZE = 160;
const LAWN_SUBDIVISIONS = 110;
/** Heights above the lawn, small enough to read as flat, large enough to never flicker. */
const BANK_LIFT = 0.03;
const WATER_LIFT = 0.07;
const PAD_LIFT = 0.09;
/** How far the sandy bank shows around the water. */
const BANK_WIDTH = 0.75;

export interface GardenBackdrop {
  /** Multiplies every garden colour (white shows it as designed). */
  tint(colour: Rgb): void;
  applyQuality(level: QualityLevel): void;
  dispose(): void;
}

/** Places copies of `mesh` with thin instances (one draw call), standing at height `y`. */
function placeCopies(mesh: Mesh, placements: readonly Placement[], y: number): void {
  const matrices = new Float32Array(placements.length * 16);
  placements.forEach((p, i) => {
    Matrix.Compose(new Vector3(p.scale, p.scale, p.scale), Quaternion.RotationYawPitchRoll(p.yaw, 0, 0), new Vector3(p.x, y, p.z)).copyToArray(matrices, i * 16);
  });
  mesh.thinInstanceSetBuffer('matrix', matrices, 16, true);
  mesh.thinInstanceRefreshBoundingInfo(false);
}

/** Paints every vertex of a flat mesh one colour (vertex colours, for the shared vinyl material). */
function paintFlat(mesh: Mesh, colour: Color3): void {
  const count = mesh.getTotalVertices();
  const colours = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) colours.set([colour.r, colour.g, colour.b, 1], i * 4);
  mesh.setVerticesData(VertexBuffer.ColorKind, colours);
}

function buildLawn(scene: Scene): { mesh: Mesh; material: PBRMaterial; texture: Texture } {
  const mesh = CreateGround('garden-lawn', { width: LAWN_SIZE, height: LAWN_SIZE, subdivisions: LAWN_SUBDIVISIONS }, scene);
  const sunny = tokenLinearColor3('--c-scene-meadow-sunny');
  const fresh = tokenLinearColor3('--c-scene-meadow-fresh');
  const shade = tokenLinearColor3('--c-scene-meadow-shade');
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const colours = new Float32Array((positions.length / 3) * 4);
  for (let i = 0; i < positions.length / 3; i += 1) {
    const v = lawnVariation(positions[i * 3] ?? 0, positions[i * 3 + 2] ?? 0);
    const c = v < 0.5 ? Color3.Lerp(shade, fresh, v * 2) : Color3.Lerp(fresh, sunny, (v - 0.5) * 2);
    colours.set([c.r, c.g, c.b, 1], i * 4);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colours);
  mesh.position.y = GROUND_Y;
  mesh.isPickable = false;
  mesh.receiveShadows = true;

  const texture = new Texture(GRASS_URL, scene);
  texture.uScale = LAWN_SIZE / GRASS_TILE;
  texture.vScale = LAWN_SIZE / GRASS_TILE;
  texture.anisotropicFilteringLevel = 8;
  const material = new PBRMaterial('garden-lawn', scene);
  material.albedoTexture = texture;
  material.metallic = 0;
  material.roughness = 1;
  mesh.material = material;
  return { mesh, material, texture };
}

/** Sandy rims under the ponds and along the stream: one flat vertex-coloured mesh. */
function buildBanks(scene: Scene): Mesh {
  const pieces = [
    ...PONDS.map((pond, i) => buildEllipse(scene, `bank-${i}`, pond, BANK_WIDTH, GROUND_Y + BANK_LIFT)),
    buildStrip(scene, 'stream-bank', STREAM_PATH, STREAM_HALF_WIDTH + BANK_WIDTH, GROUND_Y + BANK_LIFT),
  ];
  const sand = tokenLinearColor3('--c-scene-bank');
  for (const piece of pieces) paintFlat(piece, sand);
  const banks = Mesh.MergeMeshes(pieces, true, true);
  if (!banks) throw new Error('Garden banks have no parts');
  banks.name = 'garden-banks';
  banks.isPickable = false;
  banks.receiveShadows = true;
  return banks;
}

/** Pebbles round the ponds, along both banks of the stream, and a few loose on the lawn. */
function pebblePlacements(): Placement[] {
  const random = seededRandom(57);
  const rims = PONDS.flatMap((pond, i) => rimPoints(pond, i === 0 ? 34 : 20, 40 + i, BANK_WIDTH * 0.75, [0.55, 1.05]));
  const along = [STREAM_HALF_WIDTH + BANK_WIDTH * 0.7, -(STREAM_HALF_WIDTH + BANK_WIDTH * 0.7)].flatMap((offset) =>
    offsetPolyline(STREAM_PATH, offset)
      .filter((_, i) => i % 2 === 0)
      .map(([x, z]) => ({ x: x + (random() - 0.5) * 0.5, z: z + (random() - 0.5) * 0.5, scale: 0.45 + random() * 0.55, yaw: random() * Math.PI * 2 })),
  );
  const loose = scatter({ count: 8, seed: 61, inner: PLINTH_CLEAR, outerRadius: 30, minSpacing: 5, avoid: (x, z) => onWater(x, z, 1.2), scale: [0.5, 1.2] });
  return [...rims, ...along, ...loose];
}

export function createGardenBackdrop(scene: Scene, reducedMotion: boolean): GardenBackdrop {
  const lawn = buildLawn(scene);
  const water = createGardenWater(scene, PONDS, STREAM_PATH, STREAM_HALF_WIDTH, GROUND_Y + WATER_LIFT);
  const vinyl = new PBRMaterial('garden-vinyl', scene);
  vinyl.metallic = 0;
  vinyl.roughness = 0.55;
  const pieces: Mesh[] = [buildBanks(scene)];
  const add = (mesh: Mesh, placements: readonly Placement[], y = GROUND_Y): Mesh => {
    placeCopies(mesh, placements, y);
    pieces.push(mesh);
    return mesh;
  };

  // Tall things first; the scattered bits keep clear of them.
  const trees = [...BAMBOO_CLUMPS, ...PUFFY_TREES, ...BLOSSOM_TREES];
  add(buildBambooClump(scene), BAMBOO_CLUMPS);
  add(buildPuffyTree(scene, 'mint'), PUFFY_TREES);
  add(buildPuffyTree(scene, 'blossom'), BLOSSOM_TREES);
  add(buildSteppingStone(scene), STEPPING_STONES.map(([x, z], i) => ({ x, z, scale: 0.85 + (i % 3) * 0.1, yaw: i * 1.3 })), GROUND_Y + BANK_LIFT);
  add(buildPebble(scene), pebblePlacements(), GROUND_Y + BANK_LIFT);

  const nearTree = (x: number, z: number, margin: number): boolean => trees.some((t) => Math.hypot(t.x - x, t.z - z) < margin * t.scale);
  const nearStone = (x: number, z: number): boolean => STEPPING_STONES.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 1.4);
  add(
    buildBush(scene),
    scatter({ count: 34, seed: 17, inner: PLINTH_CLEAR, outerRadius: 34, minSpacing: 3, avoid: (x, z) => onWater(x, z, 1.6) || nearTree(x, z, 2.8) || nearStone(x, z), scale: [1.0, 1.6] }),
  );

  // Lily pads on both ponds; about one in three carries a lotus flower.
  const pads = PONDS.flatMap((pond, i) => pointsInside(pond, i === 0 ? 22 : 9, 70 + i, 1.15, [0.75, 1.15]));
  add(buildLilyPad(scene), pads.filter((_, i) => i % 3 !== 0), GROUND_Y + PAD_LIFT);
  add(buildLotusFlower(scene), pads.filter((_, i) => i % 3 === 0), GROUND_Y + PAD_LIFT);

  // Little flowers sprinkled over the lawn, right up to the plinth's foot.
  const flowerClear = { ...PLINTH_CLEAR, rx: 9.9, rz: 8.1 };
  const flowerTokens = ['--c-scene-flower-white', '--c-scene-flower-yellow', '--c-scene-flower-pink'] as const;
  const flowers = flowerTokens.map((token, i) =>
    add(
      buildLittleFlower(scene, token),
      scatterClusters(
        { count: 16, seed: 101 + i, inner: flowerClear, outerRadius: 36, minSpacing: 3.5, avoid: (x, z) => onWater(x, z, 0.9) || nearStone(x, z) || nearTree(x, z, 1.6), scale: [1.5, 2.2] },
        9,
        1.6,
      ),
    ),
  );

  // Far hills: big soft domes in a ring, only seen in the low close-up shots.
  const hills = buildHill(scene);
  const hillRandom = seededRandom(HILL_RING.seed);
  const hillMatrices = new Float32Array(HILL_RING.count * 16);
  for (let i = 0; i < HILL_RING.count; i += 1) {
    const angle = ((i + hillRandom() * 0.5) / HILL_RING.count) * Math.PI * 2;
    const radius = HILL_RING.radius + hillRandom() * 10;
    const width = 18 + hillRandom() * 14;
    const height = 9 + hillRandom() * 9;
    Matrix.Compose(new Vector3(width, height, width * 0.7), Quaternion.RotationYawPitchRoll(-angle, 0, 0), new Vector3(Math.cos(angle) * radius, GROUND_Y, Math.sin(angle) * radius)).copyToArray(hillMatrices, i * 16);
  }
  hills.thinInstanceSetBuffer('matrix', hillMatrices, 16, true);
  hills.thinInstanceRefreshBoundingInfo(false);
  pieces.push(hills);

  for (const piece of pieces) piece.material = vinyl;

  let observer: Observer<Scene> | null = null;
  if (!reducedMotion) {
    let timeMs = 0;
    observer = scene.onBeforeRenderObservable.add(() => {
      timeMs += scene.getEngine().getDeltaTime();
      water.update(timeMs);
    });
  }

  return {
    tint(colour) {
      // Applied as is (not converted to linear): the lights already darken the evening and night, so the tint only
      // shifts the hue and takes a little more light off; converted, it would double the darkening.
      const multiplier = new Color3(colour[0], colour[1], colour[2]);
      lawn.material.albedoColor = multiplier;
      vinyl.albedoColor = multiplier;
      water.tint(colour);
    },
    applyQuality(level) {
      for (const flower of flowers) flower.setEnabled(level.id !== 'low');
    },
    dispose() {
      if (observer) scene.onBeforeRenderObservable.remove(observer);
      for (const piece of pieces) piece.dispose();
      vinyl.dispose();
      water.dispose();
      lawn.mesh.dispose();
      lawn.material.dispose();
      lawn.texture.dispose();
    },
  };
}
