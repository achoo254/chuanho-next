/**
 * The character built from shapes in code: a little temple novice in the soft-vinyl blind-box style. A big round
 * head with ears and a forelock, an AI-drawn face, a saffron patchwork robe with a crossed collar and a bead
 * necklace, sleeved arms with mitten hands, stubby legs in slippers. Every part hangs on its own transform node so
 * the animator can turn joints:
 *
 *   root (floor position and heading) → hips (seat height, walk bob) → lean (bow and sway, about the hips)
 *     → body (breath squash) → robe, arms, head;   hips → legs
 *
 * The character faces −z. The striking arm is on +x (the wooden fish's side), the other arm on −x.
 * Built at the origin (decals are projected while the head sits at a known place), then placed by its owner.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { type ArmJoints, type LegJoints, RIG, buildArm, buildHead, buildLap, buildLeg, buildNecklace, buildRobe } from './character-body-parts';
import { type FaceDecals, buildFaceDecals } from './character-face-decals';
import type { FaceTextures } from './character-face-textures';
import { type CharacterMaterials, createCharacterMaterials } from './character-materials';
import type { FaceParts } from './face-expressions';

export { RIG, type ArmJoints, type LegJoints } from './character-body-parts';

export interface CharacterRig {
  readonly root: TransformNode;
  /** Seat height and the walk's bob. */
  readonly hips: TransformNode;
  /** Bows and sways, about the hips. */
  readonly lean: TransformNode;
  /** Squash, stretch, breathing and the beat bounce. */
  readonly body: TransformNode;
  readonly head: TransformNode;
  readonly strikeArm: ArmJoints;
  readonly freeArm: ArmJoints;
  readonly leftLeg: LegJoints;
  readonly rightLeg: LegJoints;
  readonly lap: Mesh;
  /** Child of the striking hand: the mallet hangs from here. */
  readonly grip: TransformNode;
  /** Child of the free hand: the prayer beads. */
  readonly beads: TransformNode;
  readonly materials: CharacterMaterials;
  readonly meshes: readonly AbstractMesh[];
  setFace(parts: FaceParts): void;
  dispose(): void;
}

export function buildCharacterRig(scene: Scene, textures: FaceTextures): CharacterRig {
  const meshes: AbstractMesh[] = [];
  const collect = (mesh: AbstractMesh): void => {
    mesh.isPickable = false;
    meshes.push(mesh);
  };
  const materials = createCharacterMaterials(scene, textures.robe);

  const root = new TransformNode('character', scene);
  const hips = new TransformNode('character-hips', scene);
  hips.parent = root;
  const lean = new TransformNode('character-lean', scene);
  lean.parent = hips;
  lean.position.y = RIG.pivotY;
  const body = new TransformNode('character-body', scene);
  body.parent = lean;
  body.position.y = -RIG.pivotY;

  const disposeCollar = buildRobe(scene, body, materials, collect);
  buildNecklace(scene, body, materials, collect);
  const leftLeg = buildLeg(scene, hips, -1, materials, collect);
  const rightLeg = buildLeg(scene, hips, 1, materials, collect);
  const lap = buildLap(scene, hips, materials, collect);

  const head = new TransformNode('character-head', scene);
  head.parent = body;
  head.position.y = RIG.neckY;
  const skull = buildHead(scene, head, materials, collect);
  const face: FaceDecals = buildFaceDecals(scene, skull, new Vector3(0, RIG.neckY + RIG.headCentreAboveNeck, 0), RIG.headRadius, textures);

  const strikeArm = buildArm(scene, body, 1, materials, collect);
  const freeArm = buildArm(scene, body, -1, materials, collect);
  const grip = new TransformNode('mallet-grip', scene);
  grip.parent = strikeArm.hand;
  const beads = new TransformNode('prayer-beads', scene);
  beads.parent = freeArm.hand;

  return {
    root,
    hips,
    lean,
    body,
    head,
    strikeArm,
    freeArm,
    leftLeg,
    rightLeg,
    lap,
    grip,
    beads,
    materials,
    meshes,
    setFace: (parts) => face.show(parts),
    dispose() {
      root.dispose(false, false);
      face.dispose();
      disposeCollar();
      materials.dispose();
    },
  };
}
