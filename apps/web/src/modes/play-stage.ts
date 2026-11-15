/**
 * Everything the play modes do inside the 3D scene, behind one small control surface for the React layer: the coded
 * character at its spot with the mallet and prayer beads, the wooden fish on its lotus stand (open mouth, skins,
 * squash on each hit, dust puffs), the incense stick, the Mõ Beat note orbs, merit decorations, the camera shot per
 * mode, and the share picture. Built once after the yard; disposed with the world.
 */
import type { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { buildCharacterRig, RIG } from '../character/build-character-rig';
import { createCharacterAnimator } from '../character/character-animator';
import { loadFaceTextures } from '../character/character-face-textures';
import type { FaceName, PoseName } from '../character/character-poses';
import { attachMallet, buildPrayerBeads } from '../character/held-props';
import { reachTarget } from '../character/strike-reach';
import { STRIKE_CONTACT_MS } from '../character/strike-timeline';
import { DECORATIONS, type MoSkinId, type PlayerProgress, isUnlocked } from '../game/player-progress';
import type { Diorama } from '../scene/build-diorama';
import type { CameraShotId } from '../scene/camera-shots';
import type { DioramaCamera } from '../scene/diorama-camera';
import type { MaterialPalette } from '../scene/placeholder-materials';
import { aimShareCamera, renderShareShot } from '../share3d/capture-share-shot';
import { type BeatTrack, createBeatNoteOrbs } from './beat-note-orbs';
import { createIncenseStick } from './incense-stick-3d';
import { addMoMouthCavity } from './mo-mouth-cavity';
import { createMoSkins } from './mo-skins-3d';
import type { PlayMode } from './play-mode-routing';
import { createPuffPool } from './puff-particles';

/** Fixed angle between forearm and mallet: the mallet hangs forwards-down from the fist. */
const WRIST = -0.6;
const MALLET_HEAD_RADIUS = 0.07;

const MODE_LOOK: Readonly<Record<PlayMode, { pose: PoseName; shot: CameraShotId; doze: boolean }>> = {
  yard: { pose: 'beads', shot: 'yard', doze: true },
  incense: { pose: 'palms', shot: 'incense', doze: false },
  beat: { pose: 'ready', shot: 'drum', doze: false },
  endless: { pose: 'ready', shot: 'drum', doze: false },
  sutra: { pose: 'beads', shot: 'sutra', doze: false },
  sessionEnd: { pose: 'cheer', shot: 'drum', doze: false },
  share: { pose: 'cheer', shot: 'drum', doze: false },
};

export interface PlayStage {
  setMode(mode: PlayMode): void;
  /** The character strikes (picture only: the caller plays the sound, see strike-feedback.ts). */
  strike(): void;
  flashFace(face: FaceName, forMs: number): void;
  setBeatTrack(track: BeatTrack | null, beatMs: number): void;
  popNote(noteIndex: number): void;
  /** Incense burn 0..1 (null puts the stick away) and whether it is being held. */
  setIncense(burn: number | null, holding: boolean): void;
  setMoSkin(skin: MoSkinId): void;
  setProgress(progress: PlayerProgress): void;
  /** Holds the strike pose at a time since the touch (screenshots), null to run. */
  freezeStrike(elapsedMs: number | null): void;
  /** Where the top of the wooden fish is on screen, in CSS pixels from the canvas's top left. */
  moTopOnScreen(): { x: number; y: number } | null;
  captureShareShot(): Promise<string>;
  /** True while the share shot owns the camera. */
  readonly capturing: boolean;
  readonly shadowCasters: readonly AbstractMesh[];
  update(deltaMs: number): void;
  dispose(): void;
}

interface StageParts {
  readonly scene: Scene;
  readonly engine: AbstractEngine;
  readonly view: DioramaCamera;
  readonly focusAt: (distance: number) => void;
  readonly diorama: Diorama;
  readonly palette: MaterialPalette;
  readonly reducedMotion: boolean;
  readonly signal: AbortSignal;
}

export async function createPlayStage(parts: StageParts): Promise<PlayStage> {
  const { scene, engine, view, diorama, palette, reducedMotion } = parts;
  const camera: TargetCamera = view.camera;
  const textures = await loadFaceTextures(scene, parts.signal);

  // The wooden fish sits on the lotus stand's cushion, with its open mouth added in code.
  const mo = diorama.props.get('mo') ?? null;
  const standTop = diorama.moStand.getHierarchyBoundingVectors(true).max.y;
  const mouth = mo ? addMoMouthCavity(scene, mo, palette.get('moMouth'), palette.get('mo')) : [];
  if (mo) mo.position.y = standTop - 0.02;
  // The dark hollow keeps its colour whatever the skin; the lip takes the skin's finish like the rest.
  const skins = mo ? createMoSkins(mo, mouth.slice(0, 1)) : null;
  const moBounds = mo?.getHierarchyBoundingVectors(true);
  /** The top of the wooden fish at rest: where the mallet lands, the dust jumps and the note orbs arrive. */
  const restingTop = moBounds
    ? new Vector3((moBounds.min.x + moBounds.max.x) / 2, moBounds.max.y, (moBounds.min.z + moBounds.max.z) / 2)
    : new Vector3(0, 0.6, -3);

  const rig = buildCharacterRig(scene, textures);
  rig.root.parent = diorama.characterSpot;
  const mallet = diorama.spawn('mallet', 'held-mallet');
  const malletReach = attachMallet(rig.grip, mallet, WRIST);
  const beads = buildPrayerBeads(scene, rig.beads, palette.get('wood'), palette.get('gold'));
  for (const node of [diorama.characterSpot, rig.root, rig.body]) node.computeWorldMatrix(true);

  // The strike's contact pose: the mallet head resting on top of the wooden fish, solved in the body's own space.
  const toBody = rig.body.getWorldMatrix().clone().invert();
  const target = Vector3.TransformCoordinates(restingTop.add(new Vector3(0, MALLET_HEAD_RADIUS, 0)), toBody);
  const shoulder = rig.strikeArm.shoulder.position;
  const contact = reachTarget(
    { upper: RIG.upperArm, fore: RIG.foreArm, mallet: malletReach, wrist: WRIST },
    target.x - shoulder.x,
    -(target.z - shoulder.z),
    target.y - shoulder.y,
  );
  const animator = createCharacterAnimator({ rig, mo, contact, reducedMotion, mallet, beads: rig.beads });

  const dust = createPuffPool(scene, 'mo-dust', '--c-scene-dust', 0.55, 16, { lifeMs: 520, spread: 0.9, rise: 0.35, size: 0.13, curl: 0 });
  const incenseNode = diorama.props.get('censer');
  const incense = incenseNode ? createIncenseStick(scene, incenseNode, palette.get('incense'), reducedMotion) : null;
  const orbs = createBeatNoteOrbs(scene, () => restingTop, reducedMotion);

  const shadowCasters: AbstractMesh[] = [...rig.meshes, ...mallet.getChildMeshes(false), beads, ...mouth];
  if (mallet instanceof AbstractMesh) shadowCasters.push(mallet);
  let capturing = false;
  let inFlight: Promise<string> | null = null;
  let frozenAt: number | null = null;

  return {
    get capturing() {
      return capturing;
    },
    shadowCasters,
    setMode(mode) {
      const look = MODE_LOOK[mode];
      animator.setPose(look.pose, look.doze);
      view.setShot(look.shot);
      if (mode !== 'incense') incense?.setBurn(null);
      if (mode !== 'beat') orbs.setTrack(null);
    },
    strike() {
      animator.strike(performance.now());
    },
    flashFace(face, forMs) {
      animator.flashFace(face, performance.now(), forMs);
    },
    setBeatTrack(track, beatMs) {
      orbs.setTrack(track);
      animator.setBeat(track ? () => track.songTimeMs() : null, beatMs);
    },
    popNote(noteIndex) {
      orbs.pop(noteIndex, performance.now());
    },
    setIncense(burn, holding) {
      incense?.setBurn(burn);
      incense?.setSmoking(holding);
      if (holding) animator.wake(performance.now());
    },
    setMoSkin(skin) {
      skins?.apply(skin);
    },
    setProgress(progress) {
      for (const item of DECORATIONS) diorama.decorations.get(item.id)?.setEnabled(isUnlocked(item, progress));
    },
    freezeStrike(elapsedMs) {
      frozenAt = elapsedMs;
      animator.freezeStrike(elapsedMs);
    },
    moTopOnScreen() {
      const canvas = engine.getRenderingCanvas();
      const width = engine.getRenderWidth();
      const height = engine.getRenderHeight();
      if (!canvas || width === 0 || height === 0) return null;
      const projected = Vector3.Project(restingTop, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
      return { x: (projected.x * canvas.clientWidth) / width, y: (projected.y * canvas.clientHeight) / height };
    },
    captureShareShot() {
      // One picture at a time: a second request while one renders gets the same picture (two overlapping renders
      // would fight over the camera and the engine's render size).
      inFlight ??= (async () => {
        capturing = true;
        // The picture shows the moment of the hit: mallet on the wooden fish, eyes closed in a smile.
        animator.freezeStrike(STRIKE_CONTACT_MS);
        animator.update(performance.now());
        try {
          parts.focusAt(aimShareCamera(camera));
          return await renderShareShot(engine, camera);
        } finally {
          animator.freezeStrike(frozenAt);
          capturing = false;
          inFlight = null;
        }
      })();
      return inFlight;
    },
    update(deltaMs) {
      const now = performance.now();
      if (animator.update(now) && !reducedMotion) dust.burst(restingTop, 9);
      dust.update(deltaMs);
      incense?.update(deltaMs);
      orbs.update(now);
    },
    dispose() {
      orbs.dispose();
      incense?.dispose();
      dust.dispose();
      skins?.dispose();
      // The mallet belongs to the yard's kit; take it out of the hand so the rig's disposal leaves it to the kit.
      mallet.parent = null;
      beads.dispose();
      rig.dispose();
      textures.dispose();
      for (const part of mouth) part.dispose();
    },
  };
}
