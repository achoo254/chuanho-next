/**
 * The strike on the wooden fish as a key-frame table over time since the touch: lift the mallet (anticipation),
 * swing down, hit the top of the wooden fish, bounce off a little and settle back above it. The whole move takes
 * about 0.23 s; the hit lands STRIKE_CONTACT_MS after the touch, and the sound is scheduled for that same moment, so
 * picture and sound agree and both stay within about 50 ms of the finger.
 *
 * A new touch restarts the timeline from zero (`restartStrike`): strikes never queue behind each other.
 * Everything here is pure; the animator samples it every frame.
 */
import { blendArm, clampArm } from './character-poses';
import type { ArmAngles } from './strike-reach';

/** Touch to hit. Sound and vibration are timed to it (see strike-feedback.ts). */
export const STRIKE_CONTACT_MS = 45;
/** Touch to back at rest above the wooden fish. */
export const STRIKE_DURATION_MS = 230;
/** How long the eyes stay closed in a smile after a hit. */
export const HAPPY_FACE_MS = 320;

type Ease = (t: number) => number;
const linear: Ease = (t) => t;
const easeOut: Ease = (t) => 1 - (1 - t) ** 2;
const easeIn: Ease = (t) => t * t;
const easeInOut: Ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Offsets from the contact pose that make the other key poses, so they follow wherever the wooden fish stands. The
 * lift comes mostly from the elbow: a chibi's shoulders sit inside its big head's outline, so an arm raised from the
 * shoulder would hide the mallet behind the head.
 */
const READY_OFFSET = { upper: 0.25, elbow: 0.65 };
const RAISED_OFFSET = { upper: 0.5, elbow: 0.5 };
const REBOUND_OFFSET = { upper: 0.08, elbow: 0.22 };

export type StrikeKeyName = 'ready' | 'raised' | 'contact' | 'rebound';

/** [time in ms, key pose, easing used to arrive at it]. */
export const STRIKE_KEYS: readonly (readonly [number, StrikeKeyName, Ease])[] = [
  [0, 'ready', linear],
  [18, 'raised', easeOut],
  [STRIKE_CONTACT_MS, 'contact', easeIn],
  [110, 'rebound', easeOut],
  [STRIKE_DURATION_MS, 'ready', easeInOut],
];

const offset = (contact: ArmAngles, by: { upper: number; elbow: number }): ArmAngles =>
  clampArm({ yaw: contact.yaw, upper: contact.upper + by.upper, elbow: contact.elbow + by.elbow });

/** The four key poses of a strike, derived from the pose that touches the top of the wooden fish. */
export function strikeKeyPoses(contact: ArmAngles): Readonly<Record<StrikeKeyName, ArmAngles>> {
  return { ready: offset(contact, READY_OFFSET), raised: offset(contact, RAISED_OFFSET), contact: clampArm(contact), rebound: offset(contact, REBOUND_OFFSET) };
}

/** The striking arm `elapsedMs` after the touch; before the first touch or after the end it rests at "ready". */
export function strikeArmAt(keys: Readonly<Record<StrikeKeyName, ArmAngles>>, elapsedMs: number): ArmAngles {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs >= STRIKE_DURATION_MS) return keys.ready;
  for (let i = 1; i < STRIKE_KEYS.length; i += 1) {
    const previous = STRIKE_KEYS[i - 1];
    const next = STRIKE_KEYS[i];
    if (!previous || !next || elapsedMs > next[0]) continue;
    const t = (elapsedMs - previous[0]) / (next[0] - previous[0]);
    return blendArm(keys[previous[1]], keys[next[1]], next[2](t));
  }
  return keys.ready;
}

/**
 * Vertical scale of the wooden fish after a hit: squashed at the moment of contact, a damped bounce back, settled
 * after about 0.4 s. 1 before the hit. `amount` is the deepest squash (smaller with reduced motion).
 */
export function moSquashAt(elapsedMs: number, amount = 0.16): number {
  const sinceHit = elapsedMs - STRIKE_CONTACT_MS;
  if (!Number.isFinite(sinceHit) || sinceHit < 0) return 1;
  return 1 - amount * Math.exp(-sinceHit / 60) * Math.cos((2 * Math.PI * sinceHit) / 170);
}

/** The character's own little bounce with the hit (vertical scale of the body). */
export function bodySquashAt(elapsedMs: number): number {
  const sinceHit = elapsedMs - STRIKE_CONTACT_MS;
  if (!Number.isFinite(sinceHit) || sinceHit < 0) return 1;
  return 1 - 0.05 * Math.exp(-sinceHit / 70) * Math.cos((2 * Math.PI * sinceHit) / 220);
}

/** True while the closed-eye smile should show after a hit. */
export function isHappyFaceAt(elapsedMs: number): boolean {
  return elapsedMs >= STRIKE_CONTACT_MS && elapsedMs < STRIKE_CONTACT_MS + HAPPY_FACE_MS;
}

/** When the current strike started (performance clock, ms), or null before the first one. */
export interface StrikeClock {
  readonly startedAt: number | null;
}

/** A touch: the timeline starts over from zero, whatever point the previous strike had reached. */
export function restartStrike(nowMs: number): StrikeClock {
  return { startedAt: nowMs };
}

export function strikeElapsed(clock: StrikeClock, nowMs: number): number {
  return clock.startedAt === null ? Number.POSITIVE_INFINITY : nowMs - clock.startedAt;
}

/** True when the hit moment falls between two samples of the timeline (the frame that should puff dust). */
export function crossedContact(previousElapsed: number, elapsed: number): boolean {
  return elapsed >= STRIKE_CONTACT_MS && (previousElapsed < STRIKE_CONTACT_MS || previousElapsed > elapsed);
}
