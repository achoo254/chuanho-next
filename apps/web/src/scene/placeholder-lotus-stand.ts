/**
 * The lotus stand under the wooden fish, built in code (the generated model's petals came out paper thin): two
 * staggered rings of plump petals leaning outwards, pale pink at the tips and deeper at the base, a few gold dots on
 * the petal tips, and a round green cushion on top for the wooden fish to sit on. One mesh, coloured per vertex over
 * the shared soft-vinyl material, standing on y = 0.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { PartBuilder } from './placeholder-shapes';
import { tokenLinearColor3 } from './token-colours';

interface PetalRing {
  readonly count: number;
  readonly radius: number;
  readonly y: number;
  /** Lean outwards from upright, radians. */
  readonly lean: number;
  readonly size: readonly [number, number, number];
  readonly turn: number;
}

/** Outer ring lower and wider, inner ring taller and set between the outer petals. */
const RINGS: readonly PetalRing[] = [
  { count: 8, radius: 0.25, y: 0.1, lean: 0.95, size: [0.2, 0.3, 0.08], turn: 0 },
  { count: 8, radius: 0.17, y: 0.14, lean: 0.5, size: [0.18, 0.3, 0.08], turn: Math.PI / 8 },
];
export const LOTUS_CUSHION_TOP = 0.31;

/** Gives every vertex of `mesh` a colour from its own height, before the mesh is moved (y in −0.5..0.5). */
function paintByHeight(mesh: Mesh, colourAt: (t: number) => Color3): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const colours: number[] = [];
  for (let i = 1; i < positions.length; i += 3) {
    const c = colourAt(Math.max(0, Math.min(1, (positions[i] ?? 0) + 0.5)));
    colours.push(c.r, c.g, c.b, 1);
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colours);
}

const solid = (colour: Color3) => (): Color3 => colour;

export function buildLotusStand(kit: PartBuilder): Mesh {
  const { scene } = kit;
  const tip = tokenLinearColor3('--c-scene-lotus-tip');
  const middle = tokenLinearColor3('--c-lotus');
  const base = tokenLinearColor3('--c-lotus-deep');
  const petalColour = (t: number): Color3 => (t < 0.5 ? Color3.Lerp(base, middle, t * 2) : Color3.Lerp(middle, tip, (t - 0.5) * 2));
  const parts: Mesh[] = [];
  const place = (mesh: Mesh, colourAt: (t: number) => Color3, position: readonly [number, number, number], rotation: readonly [number, number, number], scaling: readonly [number, number, number]): void => {
    paintByHeight(mesh, colourAt);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scaling.set(...scaling);
    mesh.bakeCurrentTransformIntoVertices();
    parts.push(mesh);
  };

  place(CreateCylinder('lotus-base', { diameter: 0.46, height: 0.08, tessellation: 24 }, scene), solid(base), [0, 0.04, 0], [0, 0, 0], [1, 1, 1]);
  const gold = tokenLinearColor3('--c-primary-solid');
  RINGS.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = ring.turn + (i / ring.count) * Math.PI * 2;
      const [w, h, d] = ring.size;
      const centre: [number, number, number] = [Math.sin(angle) * ring.radius, ring.y + h * 0.4, Math.cos(angle) * ring.radius];
      place(CreateSphere('petal', { diameter: 1, segments: 10 }, scene), petalColour, centre, [ring.lean, angle, 0], [w, h, d]);
      // A gold dot on the tip of every other outer petal.
      if (ringIndex === 0 && i % 2 === 0) {
        const reach = h * 0.5;
        const tipAt: [number, number, number] = [
          centre[0] + Math.sin(angle) * Math.sin(ring.lean) * reach,
          centre[1] + Math.cos(ring.lean) * reach,
          centre[2] + Math.cos(angle) * Math.sin(ring.lean) * reach,
        ];
        place(CreateSphere('dot', { diameter: 0.035, segments: 6 }, scene), solid(gold), tipAt, [0, 0, 0], [1, 1, 1]);
      }
    }
  });
  // The plump green cushion.
  place(CreateSphere('cushion', { diameter: 1, segments: 18 }, scene), solid(tokenLinearColor3('--c-leaf')), [0, LOTUS_CUSHION_TOP - 0.07, 0], [0, 0, 0], [0.42, 0.14, 0.42]);

  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) throw new Error('Lotus stand has no parts');
  merged.name = 'lotus-stand';
  merged.material = kit.palette.get('tinted');
  merged.useVertexColors = true;
  merged.hasVertexAlpha = false;
  merged.receiveShadows = true;
  merged.isPickable = false;
  return merged;
}
