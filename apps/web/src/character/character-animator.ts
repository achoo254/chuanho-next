/**
 * Moves the coded character every frame: blends between base poses, runs the strike timeline on the mallet arm,
 * squashes the wooden fish on the hit, breathes, blinks, bounces on the beat and nods off when left alone. All
 * timing comes from the pure modules next to it; this file only turns their numbers into node transforms.
 */
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { ArmJoints, CharacterRig } from './build-character-rig';
import { BASE_POSES, type CharacterPose, type FaceName, type PoseName, blendArm, blendPose } from './character-poses';
import { beatBounceAt, breathAt, isBlinkingAt, shouldDoze } from './idle-motion';
import type { ArmAngles } from './strike-reach';
import { STRIKE_DURATION_MS, type StrikeClock, bodySquashAt, crossedContact, isHappyFaceAt, moSquashAt, restartStrike, strikeArmAt, strikeElapsed, strikeKeyPoses } from './strike-timeline';

const POSE_BLEND_MS = 280;

export interface CharacterAnimator {
  /** Moves to a base pose; `canDoze` lets the character nod off after a long quiet spell (the yard only). */
  setPose(name: PoseName, canDoze: boolean): void;
  /** A touch: the strike starts over at once. */
  strike(nowMs: number): void;
  /** Shows a face for a moment (PERFECT gets the curved-eye face). */
  flashFace(face: FaceName, nowMs: number, forMs: number): void;
  /** The music clock to bounce to, or null for none. */
  setBeat(clock: (() => number | null) | null, beatMs: number): void;
  /** Any input: wakes a dozing character and restarts the quiet timer. */
  wake(nowMs: number): void;
  /** Holds the strike at a fixed time since the touch (for screenshots); null lets it run. */
  freezeStrike(elapsedMs: number | null): void;
  /** Advances to `nowMs`; true when the mallet hit the wooden fish during this frame. */
  update(nowMs: number): boolean;
}

interface AnimatorSetup {
  readonly rig: CharacterRig;
  readonly mo: TransformNode | null;
  /** The arm pose whose mallet head rests on top of the wooden fish. */
  readonly contact: ArmAngles;
  readonly reducedMotion: boolean;
  readonly mallet: TransformNode;
  readonly beads: TransformNode;
}

function applyArm(joints: ArmJoints, arm: ArmAngles, side: 1 | -1): void {
  // Roll swings the arm out in the body's plane, then yaw turns that plane towards the front (see strike-reach.ts).
  joints.shoulder.rotation.set(0, side * arm.yaw, side * arm.upper);
  joints.elbow.rotation.set(0, 0, side * arm.elbow);
}

function applySquash(node: TransformNode, vertical: number): void {
  const across = 1 / Math.sqrt(vertical);
  node.scaling.set(across, vertical, across);
}

export function createCharacterAnimator(setup: AnimatorSetup): CharacterAnimator {
  const { rig, mo, reducedMotion } = setup;
  const keys = strikeKeyPoses(setup.contact);
  let from: CharacterPose = BASE_POSES.beads;
  let to: CharacterPose = BASE_POSES.beads;
  let poseName: PoseName = 'beads';
  let poseChangedAt = 0;
  let canDoze = true;
  let dozing = false;
  let lastInputAt = 0;
  let clock: StrikeClock = { startedAt: null };
  let frozen: number | null = null;
  let previousElapsed = Number.POSITIVE_INFINITY;
  let flash: { face: FaceName; until: number } | null = null;
  let beat: { clock: () => number | null; beatMs: number } | null = null;
  let lastNow = 0;

  const moveTo = (pose: CharacterPose, nowMs: number): void => {
    from = blendPose(from, to, Math.min(1, (nowMs - poseChangedAt) / POSE_BLEND_MS));
    to = pose;
    poseChangedAt = nowMs;
  };

  const wake = (nowMs: number): void => {
    lastInputAt = nowMs;
    if (dozing) {
      dozing = false;
      moveTo(BASE_POSES[poseName], nowMs);
    }
  };

  return {
    setPose(name, doze) {
      poseName = name;
      canDoze = doze;
      dozing = false;
      lastInputAt = lastNow;
      moveTo(BASE_POSES[name], lastNow);
    },
    strike(nowMs) {
      clock = restartStrike(nowMs);
      wake(nowMs);
    },
    flashFace(face, nowMs, forMs) {
      flash = { face, until: nowMs + forMs };
    },
    setBeat(next, beatMs) {
      beat = next ? { clock: next, beatMs } : null;
    },
    wake,
    freezeStrike(elapsedMs) {
      frozen = elapsedMs;
    },
    update(nowMs) {
      lastNow = nowMs;
      if (canDoze && !dozing && shouldDoze(nowMs - lastInputAt)) {
        dozing = true;
        moveTo(BASE_POSES.dozing, nowMs);
      }
      const pose = blendPose(from, to, reducedMotion ? 1 : Math.min(1, (nowMs - poseChangedAt) / POSE_BLEND_MS));
      const elapsed = frozen ?? strikeElapsed(clock, nowMs);
      const hit = frozen === null && crossedContact(previousElapsed, elapsed);
      previousElapsed = elapsed;

      let strikeArm = pose.mallet ? strikeArmAt(keys, elapsed) : pose.strikeArm;
      if (pose.mallet && dozing && elapsed >= STRIKE_DURATION_MS) strikeArm = blendArm(strikeArm, pose.strikeArm, 0.6);
      applyArm(rig.strikeArm, strikeArm, 1);
      applyArm(rig.freeArm, pose.freeArm, -1);
      setup.mallet.setEnabled(pose.mallet);
      setup.beads.setEnabled(pose.beads);

      const breath = breathAt(nowMs, reducedMotion, dozing ? 0.03 : 0.018);
      applySquash(rig.body, bodySquashAt(elapsed) * (1 + breath));
      rig.body.position.y = reducedMotion || !beat ? 0 : beatBounceAt(beat.clock(), beat.beatMs) * 0.035;
      rig.body.rotation.x = -pose.lean;
      rig.head.rotation.set(-pose.headNod, 0, -pose.headTilt);
      if (mo) applySquash(mo, moSquashAt(elapsed, reducedMotion ? 0.06 : 0.16));

      if (flash && nowMs >= flash.until) flash = null;
      let face: FaceName = pose.face;
      if (isHappyFaceAt(elapsed)) face = 'happy';
      else if (flash) face = flash.face;
      else if (face === 'neutral' && isBlinkingAt(nowMs)) face = 'happy';
      rig.setFace(face);
      return hit;
    },
  };
}
