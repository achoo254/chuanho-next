/**
 * The shapes of the character, each a small builder: the bell-shaped robe turned on a lathe with its crossed collar,
 * the prayer-bead necklace, sleeved arms with mitten hands, stubby legs in slippers, the robe pooled over crossed
 * legs when sitting, and the big round shaved head with ears and the six incense marks of a monk.
 *
 * Heights are in the body's own space with the feet at y = 0; the character faces −z.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDecal } from '@babylonjs/core/Meshes/Builders/decalBuilder';
import { CreateLathe } from '@babylonjs/core/Meshes/Builders/latheBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { CharacterMaterials } from './character-materials';

/** Body measurements, in scene units (the character is about 1.8 tall). */
export const RIG = {
  /** The robe's outline from hem to neck: [radius, height]. Widest at the belly, narrower at the hem. */
  robeProfile: [
    [0, 0.13],
    [0.3, 0.13],
    [0.36, 0.17],
    [0.4, 0.26],
    [0.405, 0.34],
    [0.385, 0.46],
    [0.345, 0.58],
    [0.29, 0.68],
    [0.22, 0.77],
    [0.15, 0.84],
    [0, 0.87],
  ] as const,
  /** Front-to-back squash of the robe. */
  robeDepth: 0.9,
  /** The point the body leans and bows about (the hips). */
  pivotY: 0.3,
  neckY: 0.84,
  headRadius: 0.5,
  headCentreAboveNeck: 0.42,
  shoulder: [0.3, 0.66, -0.02] as const,
  upperArm: 0.2,
  foreArm: 0.18,
  armRadius: 0.078,
  handDiameter: 0.16,
  hip: [0.12, 0.2, 0.02] as const,
  leg: 0.17,
} as const;

export interface ArmJoints {
  readonly shoulder: TransformNode;
  readonly elbow: TransformNode;
  readonly hand: TransformNode;
}

export interface LegJoints {
  readonly hip: TransformNode;
  readonly ankle: TransformNode;
}

type Collect = (mesh: AbstractMesh) => void;

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** The crossed front of the robe (right over left), drawn on a canvas in the deep robe colour. */
function collarMaterial(scene: Scene): StandardMaterial {
  const size = 256;
  const texture = new DynamicTexture('character-collar', { width: size, height: size }, scene, true);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = cssToken('--c-scene-char-robe-dark');
  ctx.lineCap = 'round';
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(size * 0.2, size * 0.04);
  ctx.quadraticCurveTo(size * 0.32, size * 0.5, size * 0.62, size * 0.86);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.8, size * 0.04);
  ctx.quadraticCurveTo(size * 0.66, size * 0.4, size * 0.42, size * 0.66);
  ctx.stroke();
  texture.update();
  const material = new StandardMaterial('character-collar', scene);
  material.diffuseTexture = texture;
  material.useAlphaFromDiffuseTexture = true;
  material.specularColor = Color3.Black();
  material.emissiveColor = new Color3(0.12, 0.12, 0.12);
  material.zOffset = -2;
  return material;
}

/** The robe body, its collar ring and the crossed-front decal. */
export function buildRobe(scene: Scene, parent: TransformNode, materials: CharacterMaterials, collect: Collect): () => void {
  const shape = RIG.robeProfile.map(([radius, height]) => new Vector3(radius, height, 0));
  const robe = CreateLathe('robe', { shape, tessellation: 40, sideOrientation: Mesh.DOUBLESIDE }, scene);
  robe.scaling.z = RIG.robeDepth;
  robe.material = materials.robe;
  robe.parent = parent;
  collect(robe);

  const collar = CreateTorus('robe-collar', { diameter: 0.34, thickness: 0.075, tessellation: 24 }, scene);
  collar.position.y = RIG.neckY - 0.03;
  collar.scaling.z = RIG.robeDepth;
  collar.material = materials.robeDark;
  collar.parent = parent;
  collect(collar);

  robe.computeWorldMatrix(true);
  const front = CreateDecal('robe-front', robe, {
    position: new Vector3(0, 0.6, -0.33),
    normal: new Vector3(0, 0.25, -1).normalize(),
    size: new Vector3(0.46, 0.46, 0.5),
  });
  const material = collarMaterial(scene);
  front.material = material;
  front.setParent(robe);
  front.isPickable = false;
  return () => {
    material.diffuseTexture?.dispose();
    material.dispose();
  };
}

/** A string of chunky wooden beads around the neck, one bigger bead hanging at the front. */
export function buildNecklace(scene: Scene, parent: TransformNode, materials: CharacterMaterials, collect: Collect): void {
  const parts: Mesh[] = [];
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const bead = CreateSphere('neck-bead', { diameter: i === 0 ? 0.085 : 0.06, segments: 8 }, scene);
    bead.position.set(Math.sin(angle) * 0.215, 0, -Math.cos(angle) * 0.215 * 0.92);
    parts.push(bead);
  }
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) throw new Error('Necklace has no beads');
  merged.name = 'necklace';
  merged.material = materials.bead;
  merged.parent = parent;
  merged.position.y = RIG.neckY - 0.05;
  // Tipped forward: the front hangs on the chest, the back sits up on the collar.
  merged.rotation.x = -0.32;
  collect(merged);
}

/** A sleeved arm: shoulder, elbow and hand joints; the sleeve widens into a cuff before the mitten hand. */
export function buildArm(scene: Scene, parent: TransformNode, side: 1 | -1, materials: CharacterMaterials, collect: Collect): ArmJoints {
  const shoulder = new TransformNode(`shoulder-${side}`, scene);
  shoulder.parent = parent;
  shoulder.position.set(RIG.shoulder[0] * side, RIG.shoulder[1], RIG.shoulder[2]);
  const sleeve = (name: string, length: number, radius: number, owner: TransformNode): void => {
    const mesh = CreateCapsule(name, { height: length + radius * 2, radius, tessellation: 14, subdivisions: 1 }, scene);
    mesh.material = materials.robe;
    mesh.parent = owner;
    mesh.position.y = -length / 2;
    collect(mesh);
  };
  sleeve(`upper-arm-${side}`, RIG.upperArm, RIG.armRadius, shoulder);
  const elbow = new TransformNode(`elbow-${side}`, scene);
  elbow.parent = shoulder;
  elbow.position.y = -RIG.upperArm;
  sleeve(`fore-arm-${side}`, RIG.foreArm, RIG.armRadius * 0.95, elbow);
  const cuff = CreateCylinder(`cuff-${side}`, { height: 0.07, diameterTop: 0.17, diameterBottom: 0.2, tessellation: 16 }, scene);
  cuff.material = materials.robeDark;
  cuff.parent = elbow;
  cuff.position.y = -RIG.foreArm + 0.035;
  collect(cuff);
  const hand = new TransformNode(`hand-${side}`, scene);
  hand.parent = elbow;
  hand.position.y = -RIG.foreArm;
  const palm = CreateSphere(`palm-${side}`, { diameter: RIG.handDiameter, segments: 12 }, scene);
  palm.scaling.set(0.92, 1, 1);
  palm.position.y = -0.03;
  palm.material = materials.skin;
  palm.parent = hand;
  collect(palm);
  const thumb = CreateSphere(`thumb-${side}`, { diameter: 0.065, segments: 8 }, scene);
  thumb.position.set(0, -0.01, -0.07);
  thumb.material = materials.skin;
  thumb.parent = hand;
  collect(thumb);
  return { shoulder, elbow, hand };
}

/** A stubby leg in deep-coloured trousers ending in a rounded slipper. */
export function buildLeg(scene: Scene, parent: TransformNode, side: 1 | -1, materials: CharacterMaterials, collect: Collect): LegJoints {
  const hip = new TransformNode(`hip-${side}`, scene);
  hip.parent = parent;
  hip.position.set(RIG.hip[0] * side, RIG.hip[1], RIG.hip[2]);
  const leg = CreateCapsule(`leg-${side}`, { height: RIG.leg + 0.14, radius: 0.07, tessellation: 12, subdivisions: 1 }, scene);
  leg.position.y = -RIG.leg / 2;
  leg.material = materials.robeDark;
  leg.parent = hip;
  collect(leg);
  const ankle = new TransformNode(`ankle-${side}`, scene);
  ankle.parent = hip;
  ankle.position.y = -RIG.leg;
  const slipper = CreateSphere(`slipper-${side}`, { diameter: 1, segments: 12 }, scene);
  slipper.scaling.set(0.15, 0.09, 0.24);
  slipper.position.set(0, -0.0, -0.05);
  slipper.material = materials.shoe;
  slipper.parent = ankle;
  collect(slipper);
  return { hip, ankle };
}

/** The robe pooled over crossed legs: shown (scaled up) only while sitting. */
export function buildLap(scene: Scene, parent: TransformNode, materials: CharacterMaterials, collect: Collect): Mesh {
  const lap = CreateSphere('lap', { diameter: 1, segments: 16 }, scene);
  lap.material = materials.robe;
  lap.parent = parent;
  lap.position.set(0, 0.2, -0.2);
  lap.setEnabled(false);
  collect(lap);
  return lap;
}

/** The size of the lap at full sit. */
export const LAP_SIZE = [0.86, 0.26, 0.6] as const;

/** The skull, ears and the six incense marks on the shaved crown. Returns the skull (the face decals are projected onto it). */
export function buildHead(scene: Scene, head: TransformNode, materials: CharacterMaterials, collect: Collect): Mesh {
  const skull = CreateSphere('skull', { diameter: RIG.headRadius * 2, segments: 32 }, scene);
  skull.scaling.set(1.07, 0.96, 1);
  skull.position.y = RIG.headCentreAboveNeck;
  skull.material = materials.skin;
  skull.parent = head;
  collect(skull);
  for (const side of [1, -1] as const) {
    const ear = CreateSphere(`ear-${side}`, { diameter: 0.17, segments: 10 }, scene);
    ear.scaling.set(0.55, 1, 0.8);
    ear.position.set(0.52 * side, RIG.headCentreAboveNeck - 0.03, 0.03);
    ear.material = materials.skin;
    ear.parent = head;
    collect(ear);
  }
  // Six incense-burn marks (the ordination dots) on the shaved crown, two rows of three.
  const crownY = RIG.headCentreAboveNeck;
  const radius = RIG.headRadius;
  for (const z of [-0.075, 0.075]) {
    for (const x of [-0.13, 0, 0.13]) {
      const mark = CreateSphere('incense-mark', { diameter: 0.058, segments: 10 }, scene);
      mark.scaling.set(1, 0.38, 1);
      // On the skull's surface (an ellipsoid scaled 1.07, 0.96, 1), sunk a hair so only a flat dot shows.
      const rise = 0.96 * radius * Math.sqrt(Math.max(0, 1 - (x / (1.07 * radius)) ** 2 - (z / radius) ** 2));
      mark.position.set(x, crownY + rise - 0.004, z);
      mark.rotation.z = -x * 0.9;
      mark.rotation.x = z * 0.9;
      mark.material = materials.mark;
      mark.parent = head;
      collect(mark);
    }
  }
  return skull;
}
