/**
 * Small helpers for building placeholder props out of primitives: each helper makes one part with a material and a
 * place, and `mergeParts` fuses a prop's parts into a single mesh (one draw call per material, instanceable).
 */
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { MaterialPalette, SurfaceName } from './placeholder-materials';

export type Triple = readonly [number, number, number];

/** Builds parts for one prop; every part is merged into one mesh at the end. */
export class PartBuilder {
  private readonly parts: Mesh[] = [];

  constructor(
    private readonly scene: Scene,
    private readonly palette: MaterialPalette,
  ) {}

  private place(mesh: Mesh, surface: SurfaceName, position: Triple, rotation: Triple = [0, 0, 0], scaling: Triple = [1, 1, 1]): Mesh {
    mesh.material = this.palette.get(surface);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.scaling.set(scaling[0], scaling[1], scaling[2]);
    this.parts.push(mesh);
    return mesh;
  }

  box(surface: SurfaceName, size: Triple, position: Triple, rotation?: Triple): Mesh {
    const mesh = CreateBox('part', { width: size[0], height: size[1], depth: size[2] }, this.scene);
    return this.place(mesh, surface, position, rotation);
  }

  /** A cylinder or cone frustum; `tessellation` 4 makes a square pyramid frustum. */
  cylinder(surface: SurfaceName, top: number, bottom: number, height: number, position: Triple, rotation?: Triple, tessellation = 18): Mesh {
    const mesh = CreateCylinder('part', { diameterTop: top, diameterBottom: bottom, height, tessellation }, this.scene);
    return this.place(mesh, surface, position, rotation);
  }

  sphere(surface: SurfaceName, diameter: number, position: Triple, scaling?: Triple, segments = 16): Mesh {
    const mesh = CreateSphere('part', { diameter, segments }, this.scene);
    return this.place(mesh, surface, position, undefined, scaling);
  }

  torus(surface: SurfaceName, diameter: number, thickness: number, position: Triple): Mesh {
    const mesh = CreateTorus('part', { diameter, thickness, tessellation: 24 }, this.scene);
    return this.place(mesh, surface, position);
  }

  /**
   * A hipped roof tier: a square pyramid frustum turned 45° so its sides face the front, then squashed in depth.
   * `width` is the eave width; `depthRatio` the depth as a share of the width.
   */
  hipRoof(surface: SurfaceName, width: number, topWidth: number, height: number, depthRatio: number, position: Triple): Mesh {
    const mesh = CreateCylinder('roof', { diameterTop: topWidth * Math.SQRT2, diameterBottom: width * Math.SQRT2, height, tessellation: 4 }, this.scene);
    mesh.rotation.y = Math.PI / 4;
    mesh.bakeCurrentTransformIntoVertices();
    return this.place(mesh, surface, position, undefined, [1, 1, depthRatio]);
  }

  /** Fuses the parts into one mesh named `name` (with one sub-mesh per material). */
  merge(name: string): Mesh {
    const merged = Mesh.MergeMeshes(this.parts, true, true, undefined, false, true);
    if (!merged) throw new Error(`Placeholder ${name} has no parts`);
    merged.name = name;
    merged.receiveShadows = true;
    merged.isPickable = false;
    return merged;
  }
}
