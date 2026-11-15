/**
 * Puts the character into the yard: builds the rig and its held things (mallet, prayer beads, a little sutra book,
 * a stick of incense), the meditation cushion and the contact shadow, solves the strike's contact pose with the
 * character standing at the wooden fish, and creates the animator. The play stage owns the result.
 */
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Vec2 } from '../autonomy/yard-geometry';
import type { Diorama } from '../scene/build-diorama';
import { CHARACTER_SPOTS } from '../scene/diorama-layout';
import type { MaterialPalette } from '../scene/placeholder-materials';
import { tokenColor3 } from '../scene/token-colours';
import { type CharacterRig, RIG, buildCharacterRig } from './build-character-rig';
import { type CharacterAnimator, applyArm, createCharacterAnimator } from './character-animator';
import { type FaceTextures, loadFaceTextures } from './character-face-textures';
import { BASE_POSES, type PoseName } from './character-poses';
import { buildContactShadow, buildMeditationCushion } from './character-yard-props';
import { attachMallet, buildHeldBook, buildHeldIncense, buildPrayerBeads } from './held-props';
import { reachTarget } from './strike-reach';

/** Fixed angle between forearm and mallet: the mallet hangs forwards-down from the fist. */
const WRIST = -0.6;
const MALLET_HEAD_RADIUS = 0.07;
/** Paving and other floor pieces stand on the plinth; a foot over a narrow joint still counts as on the stone. */
const FLOOR_PREFIXES = ['pavingStone-'];
const FLOOR_MARGIN = 0.08;
/** The character a little larger than built, so it reads well from the yard view. */
const CHARACTER_SCALE = 1.15;

export interface StageCharacter {
  readonly rig: CharacterRig;
  readonly animator: CharacterAnimator;
  /** Height of the floor under a point. */
  readonly groundAt: (point: Vec2) => number;
  readonly shadowCasters: readonly AbstractMesh[];
  /** Where the top of the head is in the world, for the speech bubble. */
  headTop(): Vector3;
  dispose(): void;
}

interface CharacterParts {
  readonly scene: Scene;
  readonly diorama: Diorama;
  readonly palette: MaterialPalette;
  readonly reducedMotion: boolean;
  readonly signal: AbortSignal;
  readonly mo: TransformNode | null;
  /** The top of the wooden fish at rest, where the mallet lands. */
  readonly restingTop: Vector3;
}

/** The floor's height map, read once from the paving stones' boxes. */
function floorHeights(scene: Scene): (point: Vec2) => number {
  const boxes = scene
    .getNodes()
    .filter((node): node is TransformNode => node instanceof TransformNode && FLOOR_PREFIXES.some((prefix) => node.name.startsWith(prefix)))
    .map((node) => node.getHierarchyBoundingVectors(true));
  return (point) => {
    let height = 0;
    for (const { min, max } of boxes) {
      const over = point.x >= min.x - FLOOR_MARGIN && point.x <= max.x + FLOOR_MARGIN && point.z >= min.z - FLOOR_MARGIN && point.z <= max.z + FLOOR_MARGIN;
      if (over) height = Math.max(height, max.y);
    }
    return height;
  };
}

/** The point midway between the hands in the body's space, with the arms set to a pose (to seat held things). */
function handsMidpoint(rig: CharacterRig, pose: PoseName): Vector3 {
  applyArm(rig.strikeArm, BASE_POSES[pose].strikeArm, 1);
  applyArm(rig.freeArm, BASE_POSES[pose].freeArm, -1);
  rig.root.computeWorldMatrix(true);
  for (const node of [rig.hips, rig.lean, rig.body, rig.strikeArm.shoulder, rig.strikeArm.elbow, rig.strikeArm.hand, rig.freeArm.shoulder, rig.freeArm.elbow, rig.freeArm.hand]) {
    node.computeWorldMatrix(true);
  }
  const toBody = rig.body.getWorldMatrix().clone().invert();
  const a = Vector3.TransformCoordinates(rig.strikeArm.hand.getAbsolutePosition(), toBody);
  const b = Vector3.TransformCoordinates(rig.freeArm.hand.getAbsolutePosition(), toBody);
  return a.add(b).scale(0.5);
}

export async function createStageCharacter(parts: CharacterParts): Promise<StageCharacter> {
  const { scene, diorama, palette } = parts;
  const textures: FaceTextures = await loadFaceTextures(scene, parts.signal);
  const groundAt = floorHeights(scene);
  const rig = buildCharacterRig(scene, textures);

  // Held things: the mallet and beads hang from the hands; the book and incense sit where the hands meet.
  const mallet = diorama.spawn('mallet', 'held-mallet');
  const malletReach = attachMallet(rig.grip, mallet, WRIST);
  const beads = buildPrayerBeads(scene, rig.beads, palette.get('wood'), palette.get('gold'));
  const book = new TransformNode('held-book-anchor', scene);
  book.parent = rig.body;
  const bookMesh = buildHeldBook(scene, book, palette.get('lacquer'), palette.get('cream'));
  const incense = new TransformNode('held-incense-anchor', scene);
  incense.parent = rig.body;
  const ember = new StandardMaterial('held-incense-ember', scene);
  ember.emissiveColor = tokenColor3('--c-ember');
  ember.diffuseColor = Color3.Black();
  ember.specularColor = Color3.Black();
  const incenseMesh = buildHeldIncense(scene, incense, palette.get('incense'), ember);
  const bookAt = handsMidpoint(rig, 'chant');
  book.position.copyFrom(bookAt.add(new Vector3(0, 0.1, -0.04)));
  // Nearly upright, open towards the reader's face: the camera sees the red cover between the hands.
  book.rotation.x = 1.05;
  incense.position.copyFrom(handsMidpoint(rig, 'pray'));

  // The meditation cushion stands on its spot; the contact shadow follows the feet.
  const meditate = CHARACTER_SPOTS.meditate.position;
  const cushion = buildMeditationCushion(scene, meditate[0], meditate[2], rig.materials.cushion);
  cushion.position.y = groundAt({ x: meditate[0], z: meditate[2] });
  const shadow = buildContactShadow(scene, rig.root);

  // The strike's contact pose: the character stands at the wooden fish, the mallet head resting on its top.
  const spot = CHARACTER_SPOTS.mo;
  rig.root.position.set(spot.position[0], groundAt({ x: spot.position[0], z: spot.position[2] }), spot.position[2]);
  rig.root.rotation.y = spot.rotationY;
  rig.root.scaling.setAll(CHARACTER_SCALE);
  for (const node of [rig.root, rig.hips, rig.lean, rig.body]) node.computeWorldMatrix(true);
  const toBody = rig.body.getWorldMatrix().clone().invert();
  const target = Vector3.TransformCoordinates(parts.restingTop.add(new Vector3(0, MALLET_HEAD_RADIUS, 0)), toBody);
  const shoulder = rig.strikeArm.shoulder.position;
  const contact = reachTarget(
    { upper: RIG.upperArm, fore: RIG.foreArm, mallet: malletReach, wrist: WRIST },
    target.x - shoulder.x,
    -(target.z - shoulder.z),
    target.y - shoulder.y,
  );
  const animator = createCharacterAnimator({ rig, mo: parts.mo, contact, reducedMotion: parts.reducedMotion, held: { mallet, beads: rig.beads, book, incense } });

  const shadowCasters: AbstractMesh[] = [...rig.meshes, ...mallet.getChildMeshes(false), beads, bookMesh, incenseMesh, cushion];
  if (mallet instanceof AbstractMesh) shadowCasters.push(mallet);
  const headLift = new Vector3(0, (RIG.headCentreAboveNeck + RIG.headRadius + 0.1) * CHARACTER_SCALE, 0);
  return {
    rig,
    animator,
    groundAt,
    shadowCasters,
    headTop: () => rig.head.getAbsolutePosition().add(headLift),
    dispose() {
      // The mallet belongs to the yard's kit; take it out of the hand so the rig's disposal leaves it to the kit.
      mallet.parent = null;
      beads.dispose();
      bookMesh.dispose();
      incenseMesh.dispose();
      ember.dispose();
      cushion.dispose();
      shadow.dispose();
      rig.dispose();
      textures.dispose();
    },
  };
}
