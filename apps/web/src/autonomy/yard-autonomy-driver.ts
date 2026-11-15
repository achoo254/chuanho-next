/**
 * Plays the autonomy brain on the real character: moves its root along the floor (following the paving's height),
 * picks the pose and the moving part of each scene, steps the legs while it walks, knocks the wooden fish and rings
 * the bell with soft sounds, turns its head to whatever the player tapped, and keeps the current speech-bubble line
 * for the HUD. A play mode takes the character over through `summon`; `release` gives it back its own life.
 */
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { playSample } from '../audio/audio-engine';
import { type MotionKind, bellRingDue, knockDue, walkPhase } from '../character/activity-motion';
import type { CharacterAnimator } from '../character/character-animator';
import type { PoseName } from '../character/character-poses';
import type { CharacterSpotId } from '../scene/diorama-layout';
import type { ActivityId, BubbleIndex, BubbleTopic } from './autonomy-activities';
import { type BrainContext, type BrainEvent, type BrainState, createBrain, currentActivity, noticeAt, releaseToYard, stepBrain, summonTo } from './autonomy-brain';
import { type Vec2, wrapAngle, yawTowards } from './yard-geometry';
import { type YardMap, createYardMap } from './yard-map';

/** How long a line stays up, and the least time before another may replace it. */
export const BUBBLE_MS = 3800;
const BUBBLE_GAP_MS = 1500;
/** Sitting down and standing up take longer than other pose changes. */
const SIT_BLEND_MS = 750;
const POSE_BLEND_MS = 380;
/** How fast the feet follow a step up onto the paving (per second, exponential approach). */
const GROUND_RATE = 14;
const KNOCK_GAIN = 0.32;
const BELL_GAIN = 0.4;

const ACTIVITY_POSE: Readonly<Record<ActivityId, PoseName>> = {
  meditate: 'meditate',
  chant: 'chant',
  knock: 'beads',
  pray: 'pray',
  bell: 'stand',
  look: 'stand',
  wave: 'wave',
  rest: 'rest',
};
const SITTING: ReadonlySet<PoseName> = new Set<PoseName>(['meditate', 'rest']);

export interface BubbleLine {
  /** Changes with every new line (also when the same words come again). */
  readonly id: number;
  readonly topic: BubbleTopic;
  readonly index: BubbleIndex;
}

export interface YardAutonomy {
  /** A play mode takes the character: hurry to `spot`, then hold `pose` there. */
  summon(spot: CharacterSpotId, pose: PoseName): void;
  /** Back to the yard: the character's own scenes resume. */
  release(): void;
  /** The player tapped something at a floor point (the prop's name picks a favoured next scene). */
  notice(at: Vec2, preferred: ActivityId | null): void;
  /** True while the character stands at the wooden fish with the mallet ready (a tap strikes for real). */
  readonly atMallet: boolean;
  /** A strike just started by the player (so its hit is not the character's own soft knock). */
  playerStruck(): void;
  /** Called on the frame the mallet hits: plays the soft knock when the character struck by itself. */
  onHit(): void;
  /** The line to show now, or null. */
  bubble(nowMs: number): BubbleLine | null;
  update(nowMs: number, deltaMs: number): void;
}

interface DriverSetup {
  readonly root: TransformNode;
  readonly animator: CharacterAnimator;
  /** Height of the floor under a point (the paving stands a little above the plinth). */
  readonly groundAt: (point: Vec2) => number;
  /** Bounces a prop (the bell when it is rung). */
  readonly pulseBell: () => void;
  readonly reducedMotion: boolean;
  readonly map?: YardMap;
  readonly random?: () => number;
}

export function createYardAutonomy(setup: DriverSetup): YardAutonomy {
  const { root, animator } = setup;
  const ctx: BrainContext = { map: setup.map ?? createYardMap(), random: setup.random ?? Math.random };
  let brain: BrainState = createBrain(ctx.map.spots.mo, performance.now());
  let heldPose: PoseName = 'beads';
  let lastPose: PoseName | null = null;
  let lastMotion: { kind: MotionKind; startedAt: number } | null = null;
  let sceneElapsed = 0;
  let autoStrike = false;
  let line: (BubbleLine & { shownAt: number }) | null = null;
  let lineId = 0;
  let groundY = setup.groundAt(brain.body.position);
  let now = performance.now();

  const handle = (events: readonly BrainEvent[], nowMs: number): void => {
    for (const event of events) {
      if (event.kind !== 'say') continue;
      const priority = event.topic === 'notice' || event.topic === 'welcome';
      if (line && !priority && nowMs - line.shownAt < BUBBLE_GAP_MS) continue;
      lineId += 1;
      line = { id: lineId, topic: event.topic, index: event.index, shownAt: nowMs };
    }
  };

  const setPose = (pose: PoseName): void => {
    if (pose === lastPose) return;
    const sitting = SITTING.has(pose) || (lastPose !== null && SITTING.has(lastPose));
    animator.setPose(pose, sitting ? SIT_BLEND_MS : POSE_BLEND_MS);
    lastPose = pose;
  };

  const setMotion = (kind: MotionKind, startedAt: number): void => {
    if (lastMotion && lastMotion.kind === kind && lastMotion.startedAt === startedAt) return;
    animator.setMotion(kind, startedAt);
    lastMotion = { kind, startedAt };
  };

  const placeRoot = (deltaMs: number): void => {
    const { position, yaw } = brain.body;
    const floor = setup.groundAt(position);
    groundY += (floor - groundY) * Math.min(1, (deltaMs / 1000) * GROUND_RATE);
    root.position.set(position.x, groundY, position.z);
    root.rotation.y = yaw;
  };

  /** Pose, scene motion and the scene's own cues (knocks, the bell). */
  const animate = (nowMs: number): void => {
    const phase = brain.phase;
    const scene = currentActivity(brain);
    if (phase.kind === 'held') setPose(heldPose);
    else if (scene) setPose(ACTIVITY_POSE[scene.activity]);
    else setPose('stand');

    if (scene) {
      setMotion(scene.activity, scene.startedAt);
      const elapsed = nowMs - scene.startedAt;
      if (scene.activity === 'knock' && knockDue(sceneElapsed, elapsed) && animator.holdingMallet) {
        autoStrike = true;
        animator.strike(nowMs);
      }
      if (scene.activity === 'bell' && bellRingDue(sceneElapsed, elapsed)) {
        playSample('bell', { gain: BELL_GAIN });
        setup.pulseBell();
      }
      sceneElapsed = elapsed;
    } else {
      setMotion('none', 0);
      sceneElapsed = 0;
    }
    animator.setWalk(brain.body.stepping, walkPhase(brain.body.travelled));
    const notice = brain.notice;
    const look = notice ? wrapAngle(yawTowards(brain.body.position, notice.at, brain.body.yaw) - brain.body.yaw) : null;
    // The head turns towards it, never past the shoulder (head turns use the same sense as the body's yaw).
    animator.setHeadLook(look === null ? null : Math.max(-1, Math.min(1, look)));
  };

  return {
    summon(spot, pose) {
      heldPose = pose;
      brain = summonTo(brain, ctx.map.spots[spot], ctx);
    },
    release() {
      const step = releaseToYard(brain, now, ctx);
      brain = step.state;
      handle(step.events, now);
    },
    notice(at, preferred) {
      const step = noticeAt(brain, at, preferred, now, ctx);
      brain = step.state;
      handle(step.events, now);
      if (step.events.length > 0) animator.flashFace('surprised', now, 900);
    },
    get atMallet() {
      return animator.holdingMallet && brain.body.speed === 0 && (brain.phase.kind === 'held' || currentActivity(brain)?.activity === 'knock');
    },
    playerStruck() {
      autoStrike = false;
    },
    onHit() {
      if (!autoStrike) return;
      autoStrike = false;
      playSample('mo', { gain: KNOCK_GAIN });
    },
    bubble(nowMs) {
      if (!line || nowMs - line.shownAt > BUBBLE_MS) return null;
      return { id: line.id, topic: line.topic, index: line.index };
    },
    update(nowMs, deltaMs) {
      now = nowMs;
      const step = stepBrain(brain, nowMs, deltaMs, ctx);
      brain = step.state;
      handle(step.events, nowMs);
      placeRoot(deltaMs);
      animate(nowMs);
    },
  };
}
