/**
 * The garden's set pieces in the same chunky vinyl style as the temple kit, built from primitives and coloured per
 * vertex (one shared material for all of them, so a time-of-day tint is one colour change): lily pad, lotus flower,
 * bamboo clump, puffy tree (mint or blossom), flowering bush, pebble, stepping stone, little flower, far hill.
 * Each builder returns one merged mesh standing on y = 0; the garden repeats it with thin instances.
 */
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { seededRandom } from './backdrop-layout';
import { tokenLinearColor3 } from './token-colours';

type Triple = readonly [number, number, number];
/** A colour for a vertex from its height within the part, 0 (bottom) to 1 (top). */
type Shade = (t: number) => Color3;

const flat =
  (colour: Color3): Shade =>
  () =>
    colour;
const gradient =
  (bottom: Color3, top: Color3): Shade =>
  (t) =>
    Color3.Lerp(bottom, top, t);

/** Collects vertex-coloured parts and fuses them into one mesh. */
class ColouredParts {
  private readonly parts: Mesh[] = [];

  constructor(private readonly scene: Scene) {}

  add(mesh: Mesh, shade: Shade, position: Triple, rotation: Triple = [0, 0, 0], scaling: Triple = [1, 1, 1]): void {
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let i = 1; i < positions.length; i += 3) {
      const y = positions[i] ?? 0;
      low = Math.min(low, y);
      high = Math.max(high, y);
    }
    const span = high - low || 1;
    const colours: number[] = [];
    for (let i = 1; i < positions.length; i += 3) {
      const c = shade(((positions[i] ?? 0) - low) / span);
      colours.push(c.r, c.g, c.b, 1);
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colours);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.scaling.set(scaling[0], scaling[1], scaling[2]);
    mesh.bakeCurrentTransformIntoVertices();
    this.parts.push(mesh);
  }

  sphere(shade: Shade, position: Triple, scaling: Triple, segments = 10, rotation?: Triple): void {
    this.add(CreateSphere('part', { diameter: 1, segments }, this.scene), shade, position, rotation, scaling);
  }

  cylinder(shade: Shade, top: number, bottom: number, height: number, position: Triple, rotation?: Triple, tessellation = 10): void {
    this.add(CreateCylinder('part', { diameterTop: top, diameterBottom: bottom, height, tessellation }, this.scene), shade, position, rotation);
  }

  /** A flat disc lying on the ground (`arc` < 1 leaves a notch, like a lily pad). */
  disc(shade: Shade, radius: number, position: Triple, scaling: Triple = [1, 1, 1], arc = 1, yaw = 0): void {
    const mesh = CreateDisc('part', { radius, tessellation: 28, arc }, this.scene);
    this.add(mesh, shade, position, [Math.PI / 2, yaw, 0], scaling);
  }

  merge(name: string): Mesh {
    const merged = Mesh.MergeMeshes(this.parts, true, true);
    if (!merged) throw new Error(`Garden piece ${name} has no parts`);
    merged.name = name;
    merged.isPickable = false;
    merged.receiveShadows = true;
    return merged;
  }
}

export function buildLilyPad(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  const pad = tokenLinearColor3('--c-scene-lily-pad');
  const deep = tokenLinearColor3('--c-scene-lily-pad-deep');
  parts.disc(flat(deep), 0.62, [0, 0, 0], [1, 1, 1], 0.9);
  parts.disc(flat(pad), 0.56, [0, 0.012, 0], [1, 1, 1], 0.88);
  return parts.merge('garden-lily-pad');
}

/** A lotus flower floating on its pad: two rings of plump pink petals and a gold heart. */
export function buildLotusFlower(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  const petal = gradient(tokenLinearColor3('--c-lotus-deep'), tokenLinearColor3('--c-scene-lotus-tip'));
  parts.disc(flat(tokenLinearColor3('--c-scene-lily-pad')), 0.6, [0, 0, 0], [1, 1, 1], 0.88);
  const rings = [
    { count: 7, radius: 0.2, lean: 1.05, size: [0.2, 0.36, 0.1] as Triple, turn: 0 },
    { count: 6, radius: 0.11, lean: 0.55, size: [0.17, 0.34, 0.09] as Triple, turn: 0.45 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = ring.turn + (i / ring.count) * Math.PI * 2;
      const centre: Triple = [Math.sin(angle) * ring.radius, 0.14, Math.cos(angle) * ring.radius];
      parts.sphere(petal, centre, ring.size, 8, [ring.lean, angle, 0]);
    }
  }
  parts.sphere(flat(tokenLinearColor3('--c-scene-flower-heart')), [0, 0.2, 0], [0.13, 0.08, 0.13], 8);
  return parts.merge('garden-lotus');
}

/** A clump of bamboo: stalks with darker nodes, leaning a little apart, leaf tufts near the tops. */
export function buildBambooClump(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  const random = seededRandom(7);
  const stalk = tokenLinearColor3('--c-scene-bamboo');
  const node = tokenLinearColor3('--c-scene-bamboo-node');
  const leaf = gradient(tokenLinearColor3('--c-scene-bamboo-leaf-deep'), tokenLinearColor3('--c-scene-bamboo-leaf'));
  const stalks = 7;
  for (let s = 0; s < stalks; s += 1) {
    const angle = (s / stalks) * Math.PI * 2 + random() * 0.6;
    const spread = 0.25 + random() * 0.45;
    const baseX = Math.cos(angle) * spread;
    const baseZ = Math.sin(angle) * spread;
    const tiltX = Math.sin(angle) * 0.1;
    const tiltZ = -Math.cos(angle) * 0.1;
    const height = 3.6 + random() * 1.8;
    const segments = Math.round(height / 0.7);
    const step = height / segments;
    // Walk up the leaning stalk segment by segment.
    for (let k = 0; k < segments; k += 1) {
      const y = step * (k + 0.5);
      const x = baseX + Math.sin(-tiltZ) * y;
      const z = baseZ + Math.sin(tiltX) * y;
      const width = 0.2 - k * 0.006;
      parts.cylinder(flat(stalk), width, width, step * 0.96, [x, y, z], [tiltX, 0, tiltZ], 8);
      parts.cylinder(flat(node), width + 0.05, width + 0.05, 0.06, [x + Math.sin(-tiltZ) * step * 0.5, y + step * 0.5, z + Math.sin(tiltX) * step * 0.5], [tiltX, 0, tiltZ], 8);
    }
    for (let l = 0; l < 4; l += 1) {
      const leafAngle = random() * Math.PI * 2;
      const y = height * (0.62 + l * 0.12);
      const reach = 0.35 + random() * 0.2;
      parts.sphere(
        leaf,
        [baseX + Math.sin(-tiltZ) * y + Math.cos(leafAngle) * reach, y, baseZ + Math.sin(tiltX) * y + Math.sin(leafAngle) * reach],
        [0.95, 0.22, 0.42],
        8,
        [0, leafAngle, -0.35],
      );
    }
  }
  return parts.merge('garden-bamboo');
}

/** A round toy tree: short trunk and a cluster of puffy balls, deeper colour underneath. */
export function buildPuffyTree(scene: Scene, kind: 'mint' | 'blossom'): Mesh {
  const parts = new ColouredParts(scene);
  const random = seededRandom(kind === 'mint' ? 11 : 23);
  const [deepToken, lightToken] = kind === 'mint' ? ['--c-scene-canopy-deep', '--c-scene-canopy'] : ['--c-scene-blossom-deep', '--c-scene-blossom'];
  const canopy = gradient(tokenLinearColor3(deepToken), tokenLinearColor3(lightToken));
  parts.cylinder(flat(tokenLinearColor3('--c-trunk')), 0.32, 0.5, 2.2, [0, 1.1, 0], undefined, 10);
  parts.sphere(canopy, [0, 3.0, 0], [2.6, 2.3, 2.6], 16);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + random() * 0.5;
    const size = 1.3 + random() * 0.5;
    parts.sphere(canopy, [Math.cos(angle) * 1.05, 2.6 + random() * 0.9, Math.sin(angle) * 1.05], [size, size * 0.9, size], 14);
  }
  return parts.merge(`garden-tree-${kind}`);
}

/** A rounded bush with a sprinkle of tiny flowers. */
export function buildBush(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  const random = seededRandom(31);
  const leaves = gradient(tokenLinearColor3('--c-scene-bush-deep'), tokenLinearColor3('--c-scene-bush'));
  parts.sphere(leaves, [0, 0.45, 0], [1.3, 1.0, 1.2], 12);
  parts.sphere(leaves, [0.55, 0.32, 0.15], [0.85, 0.7, 0.85], 10);
  parts.sphere(leaves, [-0.5, 0.3, -0.1], [0.8, 0.65, 0.8], 10);
  const bloom = flat(tokenLinearColor3('--c-scene-flower-pink'));
  const white = flat(tokenLinearColor3('--c-scene-flower-white'));
  for (let i = 0; i < 9; i += 1) {
    const angle = random() * Math.PI * 2;
    const up = 0.25 + random() * 0.7;
    const r = Math.cos(up) * 0.62;
    parts.sphere(i % 3 === 0 ? white : bloom, [Math.cos(angle) * r, 0.45 + Math.sin(up) * 0.5, Math.sin(angle) * r], [0.14, 0.1, 0.14], 6);
  }
  return parts.merge('garden-bush');
}

/** A chunky pebble, lighter on top. */
export function buildPebble(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  parts.sphere(gradient(tokenLinearColor3('--c-scene-pebble-shade'), tokenLinearColor3('--c-scene-pebble')), [0, 0.12, 0], [1, 0.55, 0.8], 7);
  return parts.merge('garden-pebble');
}

export function buildSteppingStone(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  const stone = gradient(tokenLinearColor3('--c-scene-pebble-shade'), tokenLinearColor3('--c-scene-pebble'));
  parts.cylinder(stone, 1.25, 1.35, 0.16, [0, 0.06, 0], undefined, 12);
  return parts.merge('garden-stepping-stone');
}

/** A tiny five-petal flower on the lawn, in one of the garden's flower colours. */
export function buildLittleFlower(scene: Scene, token: '--c-scene-flower-white' | '--c-scene-flower-yellow' | '--c-scene-flower-pink'): Mesh {
  const parts = new ColouredParts(scene);
  const petal = flat(tokenLinearColor3(token));
  parts.cylinder(flat(tokenLinearColor3('--c-scene-bamboo-node')), 0.03, 0.03, 0.22, [0, 0.11, 0], undefined, 4);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    parts.sphere(petal, [Math.cos(angle) * 0.08, 0.24, Math.sin(angle) * 0.08], [0.12, 0.05, 0.12], 5);
  }
  parts.sphere(flat(tokenLinearColor3('--c-scene-flower-heart')), [0, 0.26, 0], [0.07, 0.05, 0.07], 5);
  return parts.merge(`garden-flower-${token}`);
}

/** One soft far hill (a squashed dome), deeper green at the foot. */
export function buildHill(scene: Scene): Mesh {
  const parts = new ColouredParts(scene);
  parts.sphere(gradient(tokenLinearColor3('--c-scene-hill-deep'), tokenLinearColor3('--c-scene-hill')), [0, 0, 0], [1, 1, 1], 18);
  return parts.merge('garden-hill');
}

/** The sandy rim under a pond (a disc a little larger than the water) or any other flat coloured patch. */
export function buildFlatPatch(scene: Scene, token: string, name: string): Mesh {
  const parts = new ColouredParts(scene);
  parts.disc(flat(tokenLinearColor3(token)), 1, [0, 0, 0]);
  return parts.merge(name);
}
