/**
 * The moving part of each scene the character plays, as pure functions of the time since the scene began: bows
 * while praying, the bob of a chant, the slow breath of meditation, a wave, a look around, the push that rings the
 * bell, the rhythm of knocks on the wooden fish, plus the walk cycle driven by distance walked. The animator adds
 * these offsets on top of the scene's base pose.
 */
import { chantPhaseAt } from './face-expressions';
import type { FaceName } from './face-expressions';
import type { ArmAngles } from './strike-reach';

export const MOTION_KINDS = ['none', 'meditate', 'chant', 'knock', 'pray', 'bell', 'look', 'wave', 'rest'] as const;
export type MotionKind = (typeof MOTION_KINDS)[number];

export interface MotionOffsets {
  readonly lean: number;
  readonly roll: number;
  readonly headNod: number;
  readonly headTurn: number;
  readonly headTilt: number;
  readonly strikeArm: ArmAngles;
  readonly freeArm: ArmAngles;
  /** Breathing: depth (vertical scale) and period. */
  readonly breathDepth: number;
  readonly breathMs: number;
  /** A face the scene asks for at this moment, or null to keep the pose's face. */
  readonly face: FaceName | null;
}

const ZERO_ARM: ArmAngles = { yaw: 0, upper: 0, elbow: 0 };
const REST: MotionOffsets = {
  lean: 0,
  roll: 0,
  headNod: 0,
  headTurn: 0,
  headTilt: 0,
  strikeArm: ZERO_ARM,
  freeArm: ZERO_ARM,
  breathDepth: 0.018,
  breathMs: 3400,
  face: null,
};

const TAU = Math.PI * 2;
/** 0 → 1 → 0 over [start, start + length], smooth at both ends. */
function bump(t: number, start: number, length: number): number {
  if (t <= start || t >= start + length) return 0;
  return Math.sin(((t - start) / length) * Math.PI) ** 2;
}

/** Praying: three slow bows from the waist, palms together, starting after a breath. */
export const BOW_START_MS = 700;
export const BOW_MS = 2400;
export const BOW_COUNT = 3;

/** The wooden fish: four knocks, a rest, again (times within one cycle, ms). */
export const KNOCK_CYCLE_MS = 4200;
export const KNOCK_TIMES_MS: readonly number[] = [500, 1250, 2000, 2750];

/** The bell: the arm draws back, pushes the striker, and the bell sounds at this moment. */
export const BELL_RING_MS = 1150;

function knockTimesUpTo(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  const cycles = Math.floor(elapsedMs / KNOCK_CYCLE_MS);
  const within = elapsedMs - cycles * KNOCK_CYCLE_MS;
  return cycles * KNOCK_TIMES_MS.length + KNOCK_TIMES_MS.filter((time) => time <= within).length;
}

/** True when a knock falls in (previous, now]: the frame that should start a strike. */
export function knockDue(previousElapsedMs: number, elapsedMs: number): boolean {
  return elapsedMs > previousElapsedMs && knockTimesUpTo(elapsedMs) > knockTimesUpTo(previousElapsedMs);
}

/** True when the bell's moment falls in (previous, now]. */
export function bellRingDue(previousElapsedMs: number, elapsedMs: number): boolean {
  return previousElapsedMs < BELL_RING_MS && elapsedMs >= BELL_RING_MS;
}

export function motionAt(kind: MotionKind, elapsedMs: number): MotionOffsets {
  const t = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
  switch (kind) {
    case 'none':
    case 'knock':
      return { ...REST, headTilt: kind === 'knock' ? 0.05 * Math.sin((t / 2100) * TAU) : 0 };
    case 'meditate':
      return { ...REST, roll: 0.02 * Math.sin((t / 7000) * TAU), headTilt: 0.03 * Math.sin((t / 9000) * TAU), breathDepth: 0.032, breathMs: 5200 };
    case 'chant': {
      const { syllable, intoMs } = chantPhaseAt(t);
      const beat = syllable >= 0 ? Math.sin(Math.min(1, intoMs / 320) * Math.PI) : 0;
      return { ...REST, headNod: 0.05 * beat, roll: 0.03 * Math.sin((t / 2600) * TAU) };
    }
    case 'pray': {
      let bow = 0;
      for (let i = 0; i < BOW_COUNT; i += 1) bow = Math.max(bow, bump(t, BOW_START_MS + i * BOW_MS, BOW_MS * 0.85));
      return { ...REST, lean: 0.34 * bow, headNod: 0.22 * bow, face: bow > 0.15 ? 'calm' : null };
    }
    case 'bell': {
      // Draw back, then push forward to the bell; listen with eyes closed while it rings.
      const back = bump(t, 300, 700);
      const push = bump(t, 850, 700);
      const swing = push - back * 0.5;
      return {
        ...REST,
        strikeArm: { yaw: 0, upper: 0.9 * swing, elbow: -0.4 * swing },
        lean: 0.06 * push,
        face: t > BELL_RING_MS + 150 ? 'calm' : null,
        headTilt: t > BELL_RING_MS ? 0.12 * Math.min(1, (t - BELL_RING_MS) / 600) : 0,
      };
    }
    case 'look': {
      const turn = Math.sin((t / 3600) * TAU);
      return { ...REST, headTurn: 0.6 * turn, headTilt: 0.08 * Math.sin((t / 1800) * TAU), headNod: -0.05 };
    }
    case 'wave': {
      const wave = Math.sin((t / 420) * TAU);
      return { ...REST, freeArm: { yaw: 0, upper: 0.12 * wave, elbow: 0.45 * wave }, headTilt: -0.12, roll: 0.03 * wave };
    }
    case 'rest':
      return { ...REST, headNod: 0.1 + 0.07 * Math.sin((t / 5200) * TAU), breathDepth: 0.03, breathMs: 4800 };
  }
}

/** The legs, arms and body of a walk at a point of the cycle (`phase` in radians of leg swing), scaled by `weight`. */
export interface WalkPose {
  /** Forward swing of each leg at the hip, radians (+ forward). */
  readonly leftLeg: number;
  readonly rightLeg: number;
  /** How high each foot lifts, 0..1. */
  readonly leftLift: number;
  readonly rightLift: number;
  readonly bob: number;
  readonly roll: number;
  /** Forward swing of each arm, radians (+ forward), opposite to its leg. */
  readonly leftArm: number;
  readonly rightArm: number;
}

/** Distance covered by one step (half a leg cycle). Short legs, small steps. */
export const STEP_LENGTH = 0.17;

export function walkPhase(travelled: number): number {
  return (travelled / STEP_LENGTH) * Math.PI;
}

export function walkPoseAt(phase: number, weight: number): WalkPose {
  const w = Math.max(0, Math.min(1.3, weight));
  const swing = Math.sin(phase);
  return {
    leftLeg: 0.55 * swing * w,
    rightLeg: -0.55 * swing * w,
    leftLift: Math.max(0, Math.cos(phase)) * w,
    rightLift: Math.max(0, -Math.cos(phase)) * w,
    bob: 0.035 * Math.abs(Math.cos(phase)) * w,
    roll: 0.06 * swing * w,
    leftArm: -0.45 * swing * w,
    rightArm: 0.45 * swing * w,
  };
}
