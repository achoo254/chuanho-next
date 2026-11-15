/**
 * The garden's water: both lotus ponds and the stream as one flat mesh with world-space texture coordinates, so one
 * material (and one draw call) covers all of it. The AI-painted water tile is laid twice at different sizes and
 * drifts in two directions, which makes the light lines shimmer instead of sliding as one picture.
 */
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import { type GroundEllipse, type Point, offsetPolyline } from './backdrop-layout';
import type { Rgb } from './lighting-presets';

const WATER_URL = '/art/backdrop/water.webp';
/** World size of one repeat of the water tile (the second layer is a little larger). */
const WATER_TILE = 4.5;
const SECOND_LAYER_SCALE = 0.72;
/** How strongly the water lights itself, so it stays bright turquoise in the shade. */
const WATER_GLOW = 0.35;

/** A flat strip between two edges of equal length (the stream, or its sandy bank), facing up at height `y`. */
export function buildStrip(scene: Scene, name: string, centre: readonly Point[], halfWidth: number, y: number): Mesh {
  const left = offsetPolyline(centre, halfWidth);
  const right = offsetPolyline(centre, -halfWidth);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  centre.forEach((_, i) => {
    const l = left[i] ?? [0, 0];
    const r = right[i] ?? [0, 0];
    positions.push(l[0], y, l[1], r[0], y, r[1]);
    normals.push(0, 1, 0, 0, 1, 0);
    const u = i / Math.max(1, centre.length - 1);
    uvs.push(u, 0, u, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      // Two triangles per span, wound to face up.
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.uvs = uvs;
  data.indices = indices;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}

/** A flat ellipse at height `y`. */
export function buildEllipse(scene: Scene, name: string, e: GroundEllipse, grow: number, y: number): Mesh {
  const mesh = CreateDisc(name, { radius: 1, tessellation: 56 }, scene);
  mesh.rotation.x = Math.PI / 2;
  mesh.scaling.set(e.rx + grow, e.rz + grow, 1);
  mesh.position.set(e.x, y, e.z);
  mesh.bakeCurrentTransformIntoVertices();
  return mesh;
}

/** Texture coordinates from world x and z, so every water piece shares one seamless tiling. */
function setWorldUvs(mesh: Mesh, tile: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) uvs.push((positions[i] ?? 0) / tile, (positions[i + 2] ?? 0) / tile);
  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

export interface GardenWater {
  readonly mesh: Mesh;
  tint(colour: Rgb): void;
  /** Moves the shimmer; `timeMs` is the scene's running time. */
  update(timeMs: number): void;
  dispose(): void;
}

export function createGardenWater(scene: Scene, ponds: readonly GroundEllipse[], stream: readonly Point[], streamHalfWidth: number, y: number): GardenWater {
  const pieces = [...ponds.map((pond, i) => buildEllipse(scene, `pond-${i}`, pond, 0, y)), buildStrip(scene, 'stream', stream, streamHalfWidth, y)];
  for (const piece of pieces) setWorldUvs(piece, WATER_TILE);
  const mesh = Mesh.MergeMeshes(pieces, true, true);
  if (!mesh) throw new Error('Garden water has no parts');
  mesh.name = 'garden-water';
  mesh.isPickable = false;
  mesh.receiveShadows = true;

  const base = new Texture(WATER_URL, scene);
  const ripple = new Texture(WATER_URL, scene);
  ripple.uScale = SECOND_LAYER_SCALE;
  ripple.vScale = SECOND_LAYER_SCALE;
  for (const texture of [base, ripple]) texture.anisotropicFilteringLevel = 8;
  const material = new PBRMaterial('garden-water', scene);
  material.albedoTexture = base;
  material.emissiveTexture = ripple;
  material.metallic = 0;
  material.roughness = 0.22;
  mesh.material = material;

  return {
    mesh,
    tint(colour) {
      // As is, like the rest of the garden (see backdrop-garden.ts).
      const multiplier = new Color3(colour[0], colour[1], colour[2]);
      material.albedoColor = multiplier;
      material.emissiveColor = multiplier.scale(WATER_GLOW);
    },
    update(timeMs) {
      const t = timeMs / 1000;
      base.uOffset = t * 0.018;
      base.vOffset = Math.sin(t * 0.21) * 0.06;
      ripple.uOffset = -t * 0.011;
      ripple.vOffset = t * 0.015;
    },
    dispose() {
      mesh.dispose();
      material.dispose();
      base.dispose();
      ripple.dispose();
    },
  };
}
