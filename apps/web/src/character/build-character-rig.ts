/**
 * The character built from shapes in code: a big round head, a round body, capsule arms and stubby legs, each part on
 * its own transform node so the animator can turn joints. Soft vinyl (matte plastic with a faint clear-coat sheen,
 * ivory white); the face and the pink cheeks are decals wrapped on the front of the head.
 *
 * The character faces −z. The striking arm is on +x (the wooden fish's side), the other arm on −x.
 * Built at the origin, then attached to its spot (decals are projected while the head sits at a known place).
 */
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateDecal } from '@babylonjs/core/Meshes/Builders/decalBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { tokenLinearColor3 } from '../scene/token-colours';
import type { FaceTextures } from './character-face-textures';
import type { FaceName } from './character-poses';

/** Body measurements, in scene units (the character is about 1.8 tall). */
export const RIG = {
  bodyCentreY: 0.47,
  bodySize: [0.78, 0.8, 0.72] as const,
  neckY: 0.84,
  headRadius: 0.5,
  headCentreAboveNeck: 0.42,
  shoulder: [0.33, 0.66, -0.04] as const,
  upperArm: 0.2,
  foreArm: 0.18,
  armRadius: 0.068,
  handDiameter: 0.15,
} as const;

export interface ArmJoints {
  readonly shoulder: TransformNode;
  readonly elbow: TransformNode;
  readonly hand: TransformNode;
}

export interface CharacterRig {
  readonly root: TransformNode;
  /** Squash, stretch and the beat bounce. */
  readonly body: TransformNode;
  readonly head: TransformNode;
  readonly strikeArm: ArmJoints;
  readonly freeArm: ArmJoints;
  /** Child of the striking hand: the mallet hangs from here. */
  readonly grip: TransformNode;
  /** Child of the free hand: the prayer beads. */
  readonly beads: TransformNode;
  readonly meshes: readonly AbstractMesh[];
  setFace(face: FaceName): void;
  dispose(): void;
}

function buildArm(scene: Scene, parent: TransformNode, side: 1 | -1, material: PBRMaterial, meshes: AbstractMesh[]): ArmJoints {
  const shoulder = new TransformNode(`shoulder-${side}`, scene);
  shoulder.parent = parent;
  shoulder.position.set(RIG.shoulder[0] * side, RIG.shoulder[1], RIG.shoulder[2]);
  const limb = (name: string, length: number, owner: TransformNode): void => {
    const mesh = CreateCapsule(name, { height: length + RIG.armRadius * 2, radius: RIG.armRadius, tessellation: 12, subdivisions: 1 }, scene);
    mesh.material = material;
    mesh.parent = owner;
    mesh.position.y = -length / 2;
    meshes.push(mesh);
  };
  limb(`upper-arm-${side}`, RIG.upperArm, shoulder);
  const elbow = new TransformNode(`elbow-${side}`, scene);
  elbow.parent = shoulder;
  elbow.position.y = -RIG.upperArm;
  limb(`fore-arm-${side}`, RIG.foreArm, elbow);
  const hand = new TransformNode(`hand-${side}`, scene);
  hand.parent = elbow;
  hand.position.y = -RIG.foreArm;
  const palm = CreateSphere(`palm-${side}`, { diameter: RIG.handDiameter, segments: 10 }, scene);
  palm.material = material;
  palm.parent = hand;
  meshes.push(palm);
  return { shoulder, elbow, hand };
}

/**
 * Decal look: the drawing's own colours, shaded only a little by the scene's light (a warm sunset would otherwise
 * turn pink cheeks orange and the far cheek muddy), no shine, and pulled towards the camera so it never flickers.
 */
function decalMaterial(scene: Scene, name: string, texture: BaseTexture): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.emissiveColor = new Color3(0.55, 0.55, 0.55);
  material.diffuseColor = new Color3(0.5, 0.5, 0.5);
  material.specularColor = Color3.Black();
  material.useAlphaFromDiffuseTexture = true;
  material.zOffset = -2;
  return material;
}

export function buildCharacterRig(scene: Scene, textures: FaceTextures): CharacterRig {
  const meshes: AbstractMesh[] = [];
  const vinyl = new PBRMaterial('character-vinyl', scene);
  vinyl.albedoColor = tokenLinearColor3('--c-scene-vinyl');
  vinyl.metallic = 0;
  vinyl.roughness = 0.55;
  vinyl.clearCoat.isEnabled = true;
  vinyl.clearCoat.intensity = 0.35;
  vinyl.clearCoat.roughness = 0.3;

  const root = new TransformNode('character', scene);
  const body = new TransformNode('character-body', scene);
  body.parent = root;
  const torso = CreateSphere('torso', { diameter: 1, segments: 20 }, scene);
  torso.scaling.set(...RIG.bodySize);
  torso.position.y = RIG.bodyCentreY;
  torso.material = vinyl;
  torso.parent = body;
  meshes.push(torso);
  for (const side of [1, -1] as const) {
    const foot = CreateCapsule(`foot-${side}`, { height: 0.26, radius: 0.085, tessellation: 12 }, scene);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(0.17 * side, 0.08, -0.08);
    foot.material = vinyl;
    foot.parent = root;
    meshes.push(foot);
  }

  const head = new TransformNode('character-head', scene);
  head.parent = body;
  head.position.y = RIG.neckY;
  const skull = CreateSphere('skull', { diameter: RIG.headRadius * 2, segments: 28 }, scene);
  skull.position.y = RIG.headCentreAboveNeck;
  skull.material = vinyl;
  skull.parent = head;
  meshes.push(skull);

  // Decals are projected while everything still sits at the origin, then kept with the head.
  skull.computeWorldMatrix(true);
  const faceAt = new Vector3(0, RIG.neckY + RIG.headCentreAboveNeck + 0.05, -RIG.headRadius);
  const outwards = new Vector3(0, 0.1, -1).normalize();
  const faceDecal = CreateDecal('face', skull, { position: faceAt, normal: outwards, size: new Vector3(1.02, 1.02, 0.7) });
  // The cheek art sits at eye height in its square; set lower and a little narrower, the cheeks land under the eyes.
  const cheeksAt = faceAt.add(new Vector3(0, -0.07, 0.01));
  const blushDecal = CreateDecal('blush', skull, { position: cheeksAt, normal: outwards, size: new Vector3(0.66, 0.66, 0.7) });
  const faceMaterials = new Map<FaceName, StandardMaterial>();
  for (const [face, texture] of Object.entries(textures.faces) as Array<[FaceName, BaseTexture]>) {
    faceMaterials.set(face, decalMaterial(scene, `face-${face}`, texture));
  }
  const blushMaterial = decalMaterial(scene, 'blush', textures.blush);
  // Both are transparent, so draw order (not depth) decides which is on top: cheeks first, then the face.
  blushDecal.alphaIndex = 1;
  faceDecal.alphaIndex = 2;
  for (const decal of [blushDecal, faceDecal]) {
    decal.setParent(skull);
    decal.isPickable = false;
  }
  blushDecal.material = blushMaterial;
  faceDecal.material = faceMaterials.get('neutral') ?? null;

  const strikeArm = buildArm(scene, body, 1, vinyl, meshes);
  const freeArm = buildArm(scene, body, -1, vinyl, meshes);
  const grip = new TransformNode('mallet-grip', scene);
  grip.parent = strikeArm.hand;
  const beads = new TransformNode('prayer-beads', scene);
  beads.parent = freeArm.hand;
  for (const mesh of meshes) mesh.isPickable = false;

  let face: FaceName = 'neutral';
  return {
    root,
    body,
    head,
    strikeArm,
    freeArm,
    grip,
    beads,
    meshes,
    setFace(next) {
      if (next === face) return;
      face = next;
      faceDecal.material = faceMaterials.get(next) ?? null;
    },
    dispose() {
      root.dispose(false, false);
      for (const material of faceMaterials.values()) material.dispose();
      blushMaterial.dispose();
      vinyl.dispose();
    },
  };
}
