/**
 * The character's poses as plain numbers: each arm's joint angles (see strike-reach.ts for the angle convention),
 * the head's tilt and nod, the body's lean, what the hands hold and which face shows. The animator blends between
 * them; every angle passes through the joint limits so no blend or keyframe can twist a limb into a broken shape.
 */
import type { ArmAngles } from './strike-reach';

export const FACES = ['neutral', 'happy', 'sleepy', 'perfect'] as const;
export type FaceName = (typeof FACES)[number];

export interface CharacterPose {
  /** The arm that holds the mallet (on the wooden fish's side). */
  readonly strikeArm: ArmAngles;
  /** The other arm (prayer beads, or the second hand of joined palms). */
  readonly freeArm: ArmAngles;
  /** Sideways tilt of the head, radians (positive leans towards the striking side). */
  readonly headTilt: number;
  /** Forward nod of the head, radians. */
  readonly headNod: number;
  /** Forward lean of the whole body, radians. */
  readonly lean: number;
  readonly mallet: boolean;
  readonly beads: boolean;
  readonly face: FaceName;
}

/** Per-joint limits in radians: wide enough for every pose, narrow enough that a limb never folds through itself. */
export const JOINT_LIMITS = {
  yaw: [-0.6, 2.4],
  upper: [-0.3, 2.9],
  elbow: [-1.2, 2.4],
} as const satisfies Record<keyof ArmAngles, readonly [number, number]>;

const clamp = (value: number, [low, high]: readonly [number, number]): number => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function clampArm(arm: ArmAngles): ArmAngles {
  return { yaw: clamp(arm.yaw, JOINT_LIMITS.yaw), upper: clamp(arm.upper, JOINT_LIMITS.upper), elbow: clamp(arm.elbow, JOINT_LIMITS.elbow) };
}

/** `t` = 0 gives `a`, 1 gives `b`; the result is always within the joint limits. */
export function blendArm(a: ArmAngles, b: ArmAngles, t: number): ArmAngles {
  return clampArm({ yaw: lerp(a.yaw, b.yaw, t), upper: lerp(a.upper, b.upper, t), elbow: lerp(a.elbow, b.elbow, t) });
}

/** Blends the numeric parts; what is held and the face switch at the halfway point. */
export function blendPose(a: CharacterPose, b: CharacterPose, t: number): CharacterPose {
  const s = Math.max(0, Math.min(1, t));
  const pick = s < 0.5 ? a : b;
  return {
    strikeArm: blendArm(a.strikeArm, b.strikeArm, s),
    freeArm: blendArm(a.freeArm, b.freeArm, s),
    headTilt: lerp(a.headTilt, b.headTilt, s),
    headNod: lerp(a.headNod, b.headNod, s),
    lean: lerp(a.lean, b.lean, s),
    mallet: pick.mallet,
    beads: pick.beads,
    face: pick.face,
  };
}

/** Arm hanging loose at the side. */
const ARM_DOWN: ArmAngles = { yaw: 0.2, upper: 0.25, elbow: 0.2 };
/** Free hand in front of the belly, holding the prayer beads. */
const ARM_BEADS: ArmAngles = { yaw: 1.25, upper: 0.55, elbow: 1.1 };
/** One hand of joined palms, in front of the chest. */
const ARM_PALMS: ArmAngles = { yaw: 1.95, upper: 0.85, elbow: 1.35 };

export const POSE_NAMES = ['ready', 'beads', 'palms', 'cheer', 'dozing'] as const;
export type PoseName = (typeof POSE_NAMES)[number];

/**
 * Base poses. The striking arm's angles here are only used when the mallet is put away; while it holds the mallet,
 * the strike timeline drives that arm (its rest is the "ready" frame above the wooden fish).
 */
export const BASE_POSES: Readonly<Record<PoseName, CharacterPose>> = {
  ready: { strikeArm: ARM_DOWN, freeArm: ARM_DOWN, headTilt: 0.06, headNod: -0.04, lean: 0.02, mallet: true, beads: false, face: 'neutral' },
  beads: { strikeArm: ARM_DOWN, freeArm: ARM_BEADS, headTilt: 0.04, headNod: 0.02, lean: 0.04, mallet: true, beads: true, face: 'neutral' },
  palms: { strikeArm: ARM_PALMS, freeArm: ARM_PALMS, headTilt: 0, headNod: 0.16, lean: 0.05, mallet: false, beads: false, face: 'happy' },
  cheer: { strikeArm: ARM_DOWN, freeArm: { yaw: 0.3, upper: 2.5, elbow: 0.3 }, headTilt: -0.12, headNod: -0.08, lean: -0.02, mallet: true, beads: false, face: 'happy' },
  dozing: { strikeArm: ARM_DOWN, freeArm: ARM_DOWN, headTilt: 0.32, headNod: 0.3, lean: 0.06, mallet: true, beads: false, face: 'sleepy' },
};
