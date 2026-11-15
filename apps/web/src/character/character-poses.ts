/**
 * The character's poses as plain numbers: each arm's joint angles (see strike-reach.ts for the angle convention),
 * the head's tilt, nod and turn, the body's lean, how it sits (legs and seat height), what the hands hold and which
 * face shows. The animator blends between them; every arm angle passes through the joint limits so no blend or
 * keyframe can twist a limb into a broken shape.
 */
import type { FaceName } from './face-expressions';
import type { ArmAngles } from './strike-reach';

export type { FaceName } from './face-expressions';

/** How the legs are set: forward swing at the hip, outward spread, inward cross (all radians), and the ankle. */
export interface LegPose {
  readonly forward: number;
  readonly spread: number;
  readonly cross: number;
  /** How far the hips slide forward from under the robe (sitting, so the legs show in front). */
  readonly reach: number;
  /** The foot's own tip at the ankle (keeps a slipper flat when the leg points forward). */
  readonly ankle: number;
}

export interface CharacterPose {
  /** The arm that holds the mallet (on the wooden fish's side). */
  readonly strikeArm: ArmAngles;
  /** The other arm (prayer beads, or the second hand of joined palms). */
  readonly freeArm: ArmAngles;
  /** Sideways tilt of the head, radians (positive leans towards the striking side). */
  readonly headTilt: number;
  /** Forward nod of the head, radians. */
  readonly headNod: number;
  /** Turn of the head, radians, in the same sense as the body's yaw. */
  readonly headTurn: number;
  /** Forward lean of the whole body, radians. */
  readonly lean: number;
  /** Height of the seat relative to standing (sitting on a cushion or the floor). */
  readonly seat: number;
  readonly legs: LegPose;
  /** 0..1: the robe pooled over crossed legs in front (sitting). */
  readonly lap: number;
  readonly mallet: boolean;
  readonly beads: boolean;
  readonly book: boolean;
  readonly incense: boolean;
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

/** Adds offsets to an arm, then clamps to the joint limits. */
export function offsetArm(arm: ArmAngles, by: ArmAngles): ArmAngles {
  return clampArm({ yaw: arm.yaw + by.yaw, upper: arm.upper + by.upper, elbow: arm.elbow + by.elbow });
}

function blendLegs(a: LegPose, b: LegPose, t: number): LegPose {
  return {
    forward: lerp(a.forward, b.forward, t),
    spread: lerp(a.spread, b.spread, t),
    cross: lerp(a.cross, b.cross, t),
    reach: lerp(a.reach, b.reach, t),
    ankle: lerp(a.ankle, b.ankle, t),
  };
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
    headTurn: lerp(a.headTurn, b.headTurn, s),
    lean: lerp(a.lean, b.lean, s),
    seat: lerp(a.seat, b.seat, s),
    legs: blendLegs(a.legs, b.legs, s),
    lap: lerp(a.lap, b.lap, s),
    mallet: pick.mallet,
    beads: pick.beads,
    book: pick.book,
    incense: pick.incense,
    face: pick.face,
  };
}

/** Arm hanging loose, a little away from the robe. */
const ARM_DOWN: ArmAngles = { yaw: 0.35, upper: 0.5, elbow: 0.25 };
/** Free hand in front of the belly, holding the prayer beads. */
const ARM_BEADS: ArmAngles = { yaw: 1.25, upper: 0.6, elbow: 1.1 };
/** One hand of joined palms, in front of the chest. */
const ARM_PALMS: ArmAngles = { yaw: 1.95, upper: 0.85, elbow: 1.35 };
/** Hands resting together in the lap (meditation). */
const ARM_LAP: ArmAngles = { yaw: 1.75, upper: 0.55, elbow: 0.75 };
/** Holding a little book up in front of the chest. */
const ARM_BOOK: ArmAngles = { yaw: 1.45, upper: 0.8, elbow: 1.2 };
/** Leaning back on the hands behind (resting on the floor). */
const ARM_PROP: ArmAngles = { yaw: -0.35, upper: 0.55, elbow: 0.05 };
/** Raised to wave. */
const ARM_WAVE: ArmAngles = { yaw: 0.45, upper: 2.45, elbow: 0.45 };

const STANDING: LegPose = { forward: 0, spread: 0, cross: 0, reach: 0, ankle: 0 };
const CROSS_LEGGED: LegPose = { forward: 1.45, spread: 0.2, cross: 0.6, reach: 0.16, ankle: -1.1 };
const LEGS_OUT: LegPose = { forward: 1.4, spread: 0.18, cross: -0.05, reach: 0.26, ankle: -0.35 };

export const POSE_NAMES = ['ready', 'beads', 'palms', 'cheer', 'stand', 'meditate', 'chant', 'pray', 'wave', 'rest'] as const;
export type PoseName = (typeof POSE_NAMES)[number];

const STAND: CharacterPose = {
  strikeArm: ARM_DOWN,
  freeArm: ARM_DOWN,
  headTilt: 0,
  headNod: 0,
  headTurn: 0,
  lean: 0,
  seat: 0,
  legs: STANDING,
  lap: 0,
  mallet: false,
  beads: false,
  book: false,
  incense: false,
  face: 'neutral',
};

/**
 * Base poses. The striking arm's angles here are only used when the mallet is put away; while it holds the mallet,
 * the strike timeline drives that arm (its rest is the "ready" frame above the wooden fish).
 */
export const BASE_POSES: Readonly<Record<PoseName, CharacterPose>> = {
  stand: STAND,
  ready: { ...STAND, headTilt: 0.06, headNod: -0.04, lean: 0.02, mallet: true },
  beads: { ...STAND, freeArm: ARM_BEADS, headTilt: 0.04, headNod: 0.02, lean: 0.04, mallet: true, beads: true },
  palms: { ...STAND, strikeArm: ARM_PALMS, freeArm: ARM_PALMS, headNod: 0.16, lean: 0.05, face: 'happy' },
  pray: { ...STAND, strikeArm: ARM_PALMS, freeArm: ARM_PALMS, headNod: 0.08, lean: 0.03, incense: true, face: 'calm' },
  cheer: { ...STAND, freeArm: { yaw: 0.3, upper: 2.5, elbow: 0.3 }, headTilt: -0.12, headNod: -0.08, lean: -0.02, mallet: true, face: 'happy' },
  wave: { ...STAND, freeArm: ARM_WAVE, headTilt: -0.1, headNod: -0.06, face: 'happy' },
  meditate: { ...STAND, strikeArm: ARM_LAP, freeArm: ARM_LAP, headNod: 0.06, seat: 0.03, legs: CROSS_LEGGED, lap: 1, face: 'calm' },
  chant: { ...STAND, strikeArm: ARM_BOOK, freeArm: ARM_BOOK, headNod: 0.24, lean: 0.03, book: true, face: 'chant' },
  rest: { ...STAND, strikeArm: ARM_PROP, freeArm: ARM_PROP, lean: -0.16, headNod: 0.1, seat: -0.1, legs: LEGS_OUT, lap: 0.55, face: 'sleepy' },
};
