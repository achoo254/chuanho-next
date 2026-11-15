/**
 * Where the striking arm has to be for the mallet head to land on the wooden fish: a two-bone reach in the arm's
 * swing plane, with the forearm, the hand and the mallet treated as one rigid piece (the wrist angle is fixed).
 * Pure math, so the contact pose follows whatever size the wooden fish and its lotus stand turn out to be.
 *
 * Angles in the swing plane are measured from straight down (0) through straight out (π/2) to straight up (π):
 * a segment at angle `a` points along (sin a, −cos a).
 */

export interface PlanePoint {
  /** Outward distance from the shoulder, along the swing plane. */
  readonly out: number;
  /** Height above the shoulder. */
  readonly up: number;
}

export interface ArmLengths {
  readonly upper: number;
  readonly fore: number;
  /** From the hand to the mallet head. */
  readonly mallet: number;
  /** Fixed angle between the forearm and the mallet. */
  readonly wrist: number;
}

/** One arm's joint angles: the swing plane's turn about the vertical, then the shoulder and elbow in that plane. */
export interface ArmAngles {
  readonly yaw: number;
  readonly upper: number;
  readonly elbow: number;
}

const direction = (angle: number): PlanePoint => ({ out: Math.sin(angle), up: -Math.cos(angle) });
const angleOf = (point: PlanePoint): number => Math.atan2(point.out, -point.up);
const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));

/** Where the mallet head ends up for a set of angles in the swing plane (forward kinematics). */
export function malletHeadAt(lengths: ArmLengths, upper: number, elbow: number): PlanePoint {
  const a1 = direction(upper);
  const a2 = direction(upper + elbow);
  const a3 = direction(upper + elbow + lengths.wrist);
  return {
    out: lengths.upper * a1.out + lengths.fore * a2.out + lengths.mallet * a3.out,
    up: lengths.upper * a1.up + lengths.fore * a2.up + lengths.mallet * a3.up,
  };
}

/**
 * Shoulder and elbow angles that put the mallet head on `target` (relative to the shoulder, in the swing plane),
 * elbow kept high like a real downward strike. A target out of reach is clamped to the nearest reachable distance
 * along the same line, so the arm still points at it.
 */
export function reachInPlane(lengths: ArmLengths, target: PlanePoint): { upper: number; elbow: number } {
  // The forearm and the mallet as one rigid segment from the elbow: its length and its turn from the forearm.
  const tipOut = lengths.fore + lengths.mallet * Math.cos(lengths.wrist);
  const tipUp = lengths.mallet * Math.sin(lengths.wrist);
  const combined = Math.hypot(tipOut, tipUp);
  const offset = Math.atan2(tipUp, tipOut);

  const minReach = Math.abs(lengths.upper - combined) + 1e-6;
  const maxReach = lengths.upper + combined - 1e-6;
  const distance = clamp(Math.hypot(target.out, target.up), minReach, maxReach);
  const towards = angleOf(target);
  const cosShoulder = (lengths.upper ** 2 + distance ** 2 - combined ** 2) / (2 * lengths.upper * distance);
  // Turning further from "down" lifts the elbow above the line to the target.
  const upper = towards + Math.acos(clamp(cosShoulder, -1, 1));
  const elbowPoint = direction(upper);
  const reach = { out: Math.sin(towards) * distance, up: -Math.cos(towards) * distance };
  const segmentAngle = angleOf({ out: reach.out - lengths.upper * elbowPoint.out, up: reach.up - lengths.upper * elbowPoint.up });
  return { upper, elbow: segmentAngle - offset - upper };
}

/**
 * The full contact pose for a target given relative to the shoulder in the character's own space: `side` is the
 * outward horizontal offset, `forward` the offset towards the character's front, `up` the height.
 */
export function reachTarget(lengths: ArmLengths, side: number, forward: number, up: number): ArmAngles {
  const yaw = Math.atan2(forward, side);
  const out = Math.hypot(side, forward);
  return { yaw, ...reachInPlane(lengths, { out, up }) };
}
