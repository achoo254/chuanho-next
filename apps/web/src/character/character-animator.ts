/**
 * Moves the coded character every frame: blends between base poses, adds the moving part of the current scene
 * (bows, chant bob, wave, bell push), runs the walk cycle on legs, arms and body, runs the strike timeline on the
 * mallet arm, squashes the wooden fish on the hit, breathes, blinks, and bounces on the beat. All timing comes from
 * the pure modules next to it; this file only turns their numbers into node transforms.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { type MotionKind, motionAt, walkPoseAt } from './activity-motion';
import type { CharacterRig } from './build-character-rig';
import { type ArmJoints, type LegJoints, LAP_SIZE, RIG } from './character-body-parts';
import { BASE_POSES, type CharacterPose, type PoseName, blendPose, offsetArm } from './character-poses';
import { type FaceName, facePartsAt } from './face-expressions';
import { beatBounceAt, breathAt, isBlinkingAt } from './idle-motion';
import type { ArmAngles } from './strike-reach';
import { type StrikeClock, bodySquashAt, crossedContact, isHappyFaceAt, moSquashAt, restartStrike, strikeArmAt, strikeElapsed, strikeKeyPoses } from './strike-timeline';

const POSE_BLEND_MS = 280;
/** How quickly the head turns towards something it noticed, per second (exponential approach). */
const HEAD_LOOK_RATE = 6;

export interface CharacterAnimator {
  /** Moves to a base pose over `blendMs` (sitting down and standing up take longer). */
  setPose(name: PoseName, blendMs?: number): void;
  /** The moving part of a scene, timed from `startedAtMs`; 'none' for plain standing. */
  setMotion(kind: MotionKind, startedAtMs: number): void;
  /** Walk cycle: `weight` 0 (standing) .. 1 (walking), `phase` from the distance walked. */
  setWalk(weight: number, phase: number): void;
  /** Turns the head towards something (radians, relative to the body), or null to look ahead. */
  setHeadLook(turn: number | null): void;
  /** A touch: the strike starts over at once. */
  strike(nowMs: number): void;
  /** Shows a face for a moment (PERFECT gets the curved-eye face). */
  flashFace(face: FaceName, nowMs: number, forMs: number): void;
  /** The music clock to bounce to, or null for none. */
  setBeat(clock: (() => number | null) | null, beatMs: number): void;
  /** Holds the strike at a fixed time since the touch (for screenshots); null lets it run. */
  freezeStrike(elapsedMs: number | null): void;
  /** Whether the mallet arm is currently ready to strike (the pose holds the mallet). */
  readonly holdingMallet: boolean;
  /** Advances to `nowMs`; true when the mallet hit the wooden fish during this frame. */
  update(nowMs: number, deltaMs: number): boolean;
}

export interface HeldItems {
  readonly mallet: TransformNode;
  readonly beads: TransformNode;
  readonly book: TransformNode;
  readonly incense: TransformNode;
}

interface AnimatorSetup {
  readonly rig: CharacterRig;
  readonly mo: TransformNode | null;
  /** The arm pose whose mallet head rests on top of the wooden fish. */
  readonly contact: ArmAngles;
  readonly reducedMotion: boolean;
  readonly held: HeldItems;
}

export function applyArm(joints: ArmJoints, arm: ArmAngles, side: 1 | -1): void {
  // Roll swings the arm out in the body's plane, then yaw turns that plane towards the front (see strike-reach.ts).
  joints.shoulder.rotation.set(0, side * arm.yaw, side * arm.upper);
  joints.elbow.rotation.set(0, 0, side * arm.elbow);
}

function applyLeg(joints: LegJoints, pose: CharacterPose, swing: number, lift: number, side: 1 | -1): void {
  const { forward, spread, cross, reach, ankle } = pose.legs;
  joints.hip.rotation.set(forward + swing, side * cross, side * spread);
  joints.hip.position.y = RIG.hip[1] + lift * 0.035;
  joints.hip.position.z = RIG.hip[2] - reach;
  joints.ankle.rotation.x = ankle - swing * 0.5;
}

function applySquash(node: TransformNode, vertical: number): void {
  const across = 1 / Math.sqrt(vertical);
  node.scaling.set(across, vertical, across);
}

function applyLap(lap: Mesh, amount: number): void {
  lap.setEnabled(amount > 0.02);
  lap.scaling.set(LAP_SIZE[0] * amount, LAP_SIZE[1] * amount, LAP_SIZE[2] * amount);
}

export function createCharacterAnimator(setup: AnimatorSetup): CharacterAnimator {
  const { rig, mo, reducedMotion, held } = setup;
  const keys = strikeKeyPoses(setup.contact);
  let from: CharacterPose = BASE_POSES.stand;
  let to: CharacterPose = BASE_POSES.stand;
  let blendMs = POSE_BLEND_MS;
  let poseChangedAt = 0;
  let motion: { kind: MotionKind; startedAt: number } = { kind: 'none', startedAt: 0 };
  let walk = { weight: 0, phase: 0 };
  let lookTarget: number | null = null;
  let headLook = 0;
  let clock: StrikeClock = { startedAt: null };
  let frozen: number | null = null;
  let previousElapsed = Number.POSITIVE_INFINITY;
  let flash: { face: FaceName; until: number } | null = null;
  let beat: { clock: () => number | null; beatMs: number } | null = null;
  let lastNow = 0;
  let holdingMallet = false;

  const blendAt = (nowMs: number): number => (reducedMotion ? 1 : Math.min(1, (nowMs - poseChangedAt) / blendMs));

  return {
    get holdingMallet() {
      return holdingMallet;
    },
    setPose(name, ms = POSE_BLEND_MS) {
      const next = BASE_POSES[name];
      if (next === to) return;
      from = blendPose(from, to, blendAt(lastNow));
      to = next;
      blendMs = Math.max(1, ms);
      poseChangedAt = lastNow;
    },
    setMotion(kind, startedAtMs) {
      motion = { kind, startedAt: startedAtMs };
    },
    setWalk(weight, phase) {
      walk = { weight: reducedMotion ? Math.min(weight, 0.4) : weight, phase };
    },
    setHeadLook(turn) {
      lookTarget = turn;
    },
    strike(nowMs) {
      clock = restartStrike(nowMs);
    },
    flashFace(face, nowMs, forMs) {
      flash = { face, until: nowMs + forMs };
    },
    setBeat(next, beatMs) {
      beat = next ? { clock: next, beatMs } : null;
    },
    freezeStrike(elapsedMs) {
      frozen = elapsedMs;
    },
    update(nowMs, deltaMs) {
      lastNow = nowMs;
      const pose = blendPose(from, to, blendAt(nowMs));
      const sceneMs = nowMs - motion.startedAt;
      const offsets = motionAt(reducedMotion ? 'none' : motion.kind, sceneMs);
      const stride = walkPoseAt(walk.phase, walk.weight);
      const elapsed = frozen ?? strikeElapsed(clock, nowMs);
      const hit = frozen === null && crossedContact(previousElapsed, elapsed);
      previousElapsed = elapsed;

      // Arms: the pose, the scene's offsets, then the walk's swing (forward = more "upper" in a front-facing plane).
      holdingMallet = pose.mallet;
      const swing = (arm: ArmAngles, amount: number): ArmAngles => offsetArm(arm, { yaw: 0.6 * walk.weight, upper: amount, elbow: 0.15 * walk.weight });
      const strikeArm = pose.mallet ? strikeArmAt(keys, elapsed) : swing(offsetArm(pose.strikeArm, offsets.strikeArm), stride.rightArm);
      const freeArm = swing(offsetArm(pose.freeArm, offsets.freeArm), stride.leftArm);
      applyArm(rig.strikeArm, strikeArm, 1);
      applyArm(rig.freeArm, freeArm, -1);
      held.mallet.setEnabled(pose.mallet);
      held.beads.setEnabled(pose.beads);
      held.book.setEnabled(pose.book);
      held.incense.setEnabled(pose.incense);

      applyLeg(rig.leftLeg, pose, stride.leftLeg, stride.leftLift, -1);
      applyLeg(rig.rightLeg, pose, stride.rightLeg, stride.rightLift, 1);
      applyLap(rig.lap, pose.lap);

      const breath = breathAt(nowMs, reducedMotion, offsets.breathDepth, offsets.breathMs);
      applySquash(rig.body, bodySquashAt(elapsed) * (1 + breath));
      const bounce = reducedMotion || !beat ? 0 : beatBounceAt(beat.clock(), beat.beatMs) * 0.035;
      rig.hips.position.y = pose.seat + stride.bob + bounce;
      rig.lean.rotation.set(-(pose.lean + offsets.lean), 0, -(stride.roll + offsets.roll));

      const lookAim = lookTarget ?? 0;
      headLook += (lookAim - headLook) * Math.min(1, (deltaMs / 1000) * HEAD_LOOK_RATE);
      rig.head.rotation.set(-(pose.headNod + offsets.headNod), pose.headTurn + offsets.headTurn + headLook, -(pose.headTilt + offsets.headTilt));
      if (mo) applySquash(mo, moSquashAt(elapsed, reducedMotion ? 0.06 : 0.16));

      if (flash && nowMs >= flash.until) flash = null;
      let face: FaceName = offsets.face ?? pose.face;
      if (pose.mallet && isHappyFaceAt(elapsed)) face = 'happy';
      else if (flash) face = flash.face;
      rig.setFace(facePartsAt(face, sceneMs, isBlinkingAt(nowMs)));
      return hit;
    },
  };
}
