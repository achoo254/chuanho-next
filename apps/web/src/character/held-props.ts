/**
 * What the character holds: the mallet in the striking hand (the kit's `dui` model when present, the coded mallet
 * otherwise), a loop of prayer beads in the other hand, a little sutra book and a stick of incense. Each hangs from
 * its attach node.
 */
import type { Material } from '@babylonjs/core/Materials/material';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

/** Where along the mallet the hand closes, as a share of its length from the handle end. */
const GRIP_AT = 0.16;
/** The head's centre, as a share of the length back from the tip. */
const HEAD_FROM_TIP = 0.12;

/**
 * Puts the mallet in the hand and returns the distance from the grip to the head's centre. The mallet arrives
 * upright (head up, as both the coded mallet and the fitted model are); in the hand it points along the forearm's
 * line, turned by the fixed wrist angle, held near the handle's end.
 */
export function attachMallet(grip: TransformNode, mallet: TransformNode, wrist: number): number {
  mallet.position.set(0, 0, 0);
  mallet.rotation.set(0, 0, 0);
  mallet.computeWorldMatrix(true);
  const { min, max } = mallet.getHierarchyBoundingVectors(true);
  const length = Math.max(max.y - min.y, 0.2);
  const gripY = min.y + length * GRIP_AT;
  const headY = max.y - length * HEAD_FROM_TIP;

  grip.rotation.z = wrist;
  mallet.parent = grip;
  // Turned head-down along the arm, then shifted so the grip point sits in the palm.
  mallet.rotation.set(0, 0, Math.PI);
  mallet.position.set(0, gripY, 0);
  for (const mesh of mallet.getChildMeshes(false)) mesh.isPickable = false;
  if (mallet instanceof Mesh) mallet.isPickable = false;
  return headY - gripY;
}

/** A loop of wooden prayer beads hanging under the hand, one gold bead at the bottom. */
export function buildPrayerBeads(scene: Scene, parent: TransformNode, wood: Material, gold: Material): Mesh {
  const parts: Mesh[] = [];
  const count = 14;
  const radius = 0.1;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const bead = CreateSphere('bead', { diameter: i === 0 ? 0.05 : 0.036, segments: 6 }, scene);
    bead.position.set(Math.sin(angle) * radius * 0.6, -radius - Math.cos(angle) * radius, -0.02);
    bead.material = i === 0 ? gold : wood;
    parts.push(bead);
  }
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  if (!merged) throw new Error('Prayer beads have no parts');
  merged.name = 'prayer-beads-loop';
  merged.parent = parent;
  merged.isPickable = false;
  return merged;
}

/** A small open sutra book held up for reading: two covers in a shallow V, cream pages on top. */
export function buildHeldBook(scene: Scene, parent: TransformNode, cover: Material, pages: Material): Mesh {
  const parts: Mesh[] = [];
  for (const side of [1, -1] as const) {
    const board = CreateBox('book-cover', { width: 0.25, height: 0.018, depth: 0.34 }, scene);
    board.position.set(0.12 * side, 0, 0);
    board.rotation.z = -0.22 * side;
    board.material = cover;
    parts.push(board);
    const leaf = CreateBox('book-pages', { width: 0.23, height: 0.026, depth: 0.31 }, scene);
    leaf.position.set(0.114 * side, 0.02, 0);
    leaf.rotation.z = -0.22 * side;
    leaf.material = pages;
    parts.push(leaf);
  }
  const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  if (!merged) throw new Error('Book has no parts');
  merged.name = 'held-book';
  merged.parent = parent;
  merged.isPickable = false;
  return merged;
}

/** One stick of incense with a glowing tip, held upright between joined palms. */
export function buildHeldIncense(scene: Scene, parent: TransformNode, stick: Material, ember: Material): Mesh {
  const body = CreateCylinder('held-incense-stick', { height: 0.5, diameter: 0.026, tessellation: 6 }, scene);
  body.position.y = 0.18;
  body.material = stick;
  const tip = CreateSphere('held-incense-ember', { diameter: 0.048, segments: 6 }, scene);
  tip.position.y = 0.43;
  tip.material = ember;
  const merged = Mesh.MergeMeshes([body, tip], true, true, undefined, false, true);
  if (!merged) throw new Error('Incense has no parts');
  merged.name = 'held-incense';
  merged.parent = parent;
  merged.isPickable = false;
  return merged;
}
