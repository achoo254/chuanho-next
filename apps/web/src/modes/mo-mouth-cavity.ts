/**
 * The wooden fish's open mouth, added in code: the generated model only has a shallow groove where the mouth should
 * gape, and the placeholder has none. A dark, flattened hollow is set slightly into the front of the lower half,
 * with a gently jutting upper lip above it, so it reads as a wide mouth cut across the front.
 *
 * Placed from the wooden fish's own bounds (in its local space, front = −z), so it lands in the same spot on the
 * placeholder and on a model of any size. Tune MO_MOUTH if a new model's mouth sits elsewhere.
 */
import type { Material } from '@babylonjs/core/Materials/material';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

/** Shares of the wooden fish's height, width and depth. */
export const MO_MOUTH = {
  /** Mouth line above the base. */
  height: 0.4,
  width: 0.66,
  /** How tall the gap is. */
  gap: 0.12,
  /** How deep the hollow reaches back. */
  depth: 0.3,
  /** How far the hollow's centre sits behind the front surface. */
  recess: 0.1,
} as const;

/** Bounds of `node` in its own space: its transform is set aside for the measurement. */
function localBounds(node: TransformNode): { min: Vector3; max: Vector3 } {
  const saved = { position: node.position.clone(), rotation: node.rotation.clone(), scaling: node.scaling.clone(), quaternion: node.rotationQuaternion };
  node.position.setAll(0);
  node.rotation.setAll(0);
  node.rotationQuaternion = null;
  node.scaling.setAll(1);
  node.computeWorldMatrix(true);
  const bounds = node.getHierarchyBoundingVectors(true);
  node.position.copyFrom(saved.position);
  node.rotation.copyFrom(saved.rotation);
  node.rotationQuaternion = saved.quaternion;
  node.scaling.copyFrom(saved.scaling);
  node.computeWorldMatrix(true);
  return bounds;
}

/** Adds the hollow and lip as children of the wooden fish (they squash with it and count as tapping it). */
export function addMoMouthCavity(scene: Scene, mo: TransformNode, hollow: Material, lip: Material): AbstractMesh[] {
  const { min, max } = localBounds(mo);
  const size = max.subtract(min);
  const centreX = (min.x + max.x) / 2;
  const mouthY = min.y + size.y * MO_MOUTH.height;
  const front = min.z;

  const cavity = CreateSphere('mo-mouth', { diameter: 1, segments: 16 }, scene);
  cavity.scaling.set(size.x * MO_MOUTH.width, size.y * MO_MOUTH.gap, size.z * MO_MOUTH.depth);
  cavity.position.set(centreX, mouthY, front + size.z * MO_MOUTH.recess);
  cavity.material = hollow;

  const upperLip = CreateSphere('mo-lip', { diameter: 1, segments: 16 }, scene);
  upperLip.scaling.set(size.x * MO_MOUTH.width * 1.04, size.y * 0.07, size.z * 0.16);
  upperLip.position.set(centreX, mouthY + size.y * MO_MOUTH.gap * 0.55, front + size.z * 0.06);
  upperLip.material = lip;

  const parts = [cavity, upperLip];
  for (const part of parts) {
    part.parent = mo;
    part.isPickable = true;
    part.receiveShadows = true;
  }
  return parts;
}
