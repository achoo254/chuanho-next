/**
 * Everything the play modes do inside the 3D scene, behind one small control surface for the React layer: the coded
 * character (living its own life in the yard, called to its spot by a play mode), the wooden fish on its lotus stand
 * (open mouth, skins, squash on each hit, dust puffs), the incense stick, the Mõ Beat note orbs, merit decorations,
 * the camera shot per mode, the character's speech bubble, and the share picture. Built once after the yard;
 * disposed with the world.
 */
import type { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { ActivityId } from '../autonomy/autonomy-activities';
import { type BubbleLine, createYardAutonomy } from '../autonomy/yard-autonomy-driver';
import type { FaceName, PoseName } from '../character/character-poses';
import { createStageCharacter } from '../character/create-stage-character';
import { STRIKE_CONTACT_MS } from '../character/strike-timeline';
import { DECORATIONS, type MoSkinId, type PlayerProgress, isUnlocked } from '../game/player-progress';
import type { Diorama } from '../scene/build-diorama';
import type { CameraShotId } from '../scene/camera-shots';
import type { DioramaCamera } from '../scene/diorama-camera';
import type { CharacterSpotId } from '../scene/diorama-layout';
import type { MaterialPalette } from '../scene/placeholder-materials';
import type { InteractivePropId } from '../scene/world-actions';
import { aimShareCamera, renderShareShot } from '../share3d/capture-share-shot';
import { type BeatTrack, createBeatNoteOrbs } from './beat-note-orbs';
import { createIncenseStick } from './incense-stick-3d';
import { addMoMouthCavity } from './mo-mouth-cavity';
import { createMoSkins } from './mo-skins-3d';
import type { PlayMode } from './play-mode-routing';
import { createPuffPool } from './puff-particles';

const MODE_LOOK: Readonly<Record<Exclude<PlayMode, 'yard'>, { pose: PoseName; shot: CameraShotId; spot: CharacterSpotId }>> = {
  incense: { pose: 'palms', shot: 'incense', spot: 'pray' },
  beat: { pose: 'ready', shot: 'drum', spot: 'mo' },
  endless: { pose: 'ready', shot: 'drum', spot: 'mo' },
  sutra: { pose: 'beads', shot: 'sutra', spot: 'mo' },
  sessionEnd: { pose: 'cheer', shot: 'drum', spot: 'mo' },
  share: { pose: 'cheer', shot: 'drum', spot: 'mo' },
};

/** The scene a tap on a prop makes likelier next (the character wants a go too). */
const PROP_FAVOURS: Partial<Record<InteractivePropId, ActivityId>> = { mo: 'knock', bell: 'bell', censer: 'pray', sutraShelf: 'chant' };

/** What the speech bubble needs each frame: the line, and where the head is on screen (CSS pixels). */
export interface CharacterBubbleFrame {
  readonly line: BubbleLine | null;
  readonly anchor: { readonly x: number; readonly y: number } | null;
}

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
  /** The player tapped a prop in the yard: the character looks over and says something. */
  notice(prop: InteractivePropId): void;
  /** The speech bubble's line and the character's head on screen. */
  characterBubble(): CharacterBubbleFrame;
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
  /** Bounces a prop (the character rings the bell by itself). */
  readonly pulseProp: (prop: InteractivePropId) => void;
}

export async function createPlayStage(parts: StageParts): Promise<PlayStage> {
  const { scene, engine, view, diorama, palette, reducedMotion } = parts;
  const camera: TargetCamera = view.camera;

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

  const character = await createStageCharacter({ scene, diorama, palette, reducedMotion, signal: parts.signal, mo, restingTop });
  const { animator } = character;
  const autonomy = createYardAutonomy({
    root: character.rig.root,
    animator,
    groundAt: character.groundAt,
    pulseBell: () => parts.pulseProp('bell'),
    reducedMotion,
  });

  const dust = createPuffPool(scene, 'mo-dust', '--c-scene-dust', 0.55, 16, { lifeMs: 520, spread: 0.9, rise: 0.35, size: 0.13, curl: 0 });
  const incenseNode = diorama.props.get('censer');
  const incense = incenseNode ? createIncenseStick(scene, incenseNode, palette.get('incense'), reducedMotion) : null;
  const orbs = createBeatNoteOrbs(scene, () => restingTop, reducedMotion);

  const shadowCasters: AbstractMesh[] = [...character.shadowCasters, ...mouth];
  let capturing = false;
  let inFlight: Promise<string> | null = null;
  let frozenAt: number | null = null;

  /** A world point on screen in CSS pixels, or null when it is behind the camera or the canvas is not laid out. */
  const toScreen = (point: Vector3): { x: number; y: number } | null => {
    const canvas = engine.getRenderingCanvas();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    if (!canvas || width === 0 || height === 0) return null;
    const projected = Vector3.Project(point, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(width, height));
    if (projected.z < 0 || projected.z > 1) return null;
    return { x: (projected.x * canvas.clientWidth) / width, y: (projected.y * canvas.clientHeight) / height };
  };

  return {
    get capturing() {
      return capturing;
    },
    shadowCasters,
    setMode(mode) {
      if (mode === 'yard') {
        view.setShot('yard');
        autonomy.release();
      } else {
        const look = MODE_LOOK[mode];
        view.setShot(look.shot);
        autonomy.summon(look.spot, look.pose);
      }
      if (mode !== 'incense') incense?.setBurn(null);
      if (mode !== 'beat') orbs.setTrack(null);
    },
    strike() {
      autonomy.playerStruck();
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
    },
    setMoSkin(skin) {
      skins?.apply(skin);
    },
    setProgress(progress) {
      for (const item of DECORATIONS) diorama.decorations.get(item.id)?.setEnabled(isUnlocked(item, progress));
    },
    notice(prop) {
      const node = diorama.props.get(prop);
      if (!node) return;
      const at = node.getAbsolutePosition();
      autonomy.notice({ x: at.x, z: at.z }, PROP_FAVOURS[prop] ?? null);
    },
    characterBubble() {
      const line = autonomy.bubble(performance.now());
      return { line, anchor: line ? toScreen(character.headTop()) : null };
    },
    freezeStrike(elapsedMs) {
      frozenAt = elapsedMs;
      animator.freezeStrike(elapsedMs);
    },
    moTopOnScreen() {
      return toScreen(restingTop);
    },
    captureShareShot() {
      // One picture at a time: a second request while one renders gets the same picture (two overlapping renders
      // would fight over the camera and the engine's render size).
      inFlight ??= (async () => {
        capturing = true;
        // The picture shows the moment of the hit: mallet on the wooden fish, eyes closed in a smile.
        animator.freezeStrike(STRIKE_CONTACT_MS);
        animator.update(performance.now(), 0);
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
      autonomy.update(now, deltaMs);
      if (animator.update(now, deltaMs)) {
        if (!reducedMotion) dust.burst(restingTop, 9);
        autonomy.onHit();
      }
      dust.update(deltaMs);
      incense?.update(deltaMs);
      orbs.update(now);
    },
    dispose() {
      orbs.dispose();
      incense?.dispose();
      dust.dispose();
      skins?.dispose();
      character.dispose();
      for (const part of mouth) part.dispose();
    },
  };
}
