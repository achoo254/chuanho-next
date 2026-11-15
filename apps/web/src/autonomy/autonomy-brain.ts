/**
 * The character's own little life in the yard as a pure state machine: rest a moment, pick a scene, walk there
 * (turning towards each corner of the route, never jumping), turn to face the right way, play the scene for a while,
 * then pick another. A play mode summons it: it hurries to the mode's spot and stays until the yard comes back.
 * A tap on a prop only makes it look over and say something; whatever it was doing goes on.
 *
 * Every step takes the time and a random source and returns the next state plus what happened (lines to say,
 * scenes beginning), so the whole schedule is replayable in tests. The scene (bodies, sounds, bubbles) lives in
 * `yard-autonomy-driver.ts`.
 */
import { type ActivityId, type BubbleIndex, type BubbleTopic, type Random, ACTIVITY_SPECS, pickActivity, pickDuration, pickLine } from './autonomy-activities';
import { type Vec2, distance, stepTowards, turnTowards, wrapAngle, yawTowards } from './yard-geometry';
import type { Spot, YardMap } from './yard-map';

/** Walking pace and the hurried pace when a play mode calls, in yard units per second. */
export const WALK_SPEED = 0.95;
export const HURRY_SPEED = 2.6;
/** How fast the body turns, radians per second. */
const TURN_RATE = 4.5;
const HURRY_TURN_RATE = 9;
const ACCELERATION = 3.5;
/** Close enough to a corner of the route to head for the next. */
const ARRIVED = 0.02;
const FACING = 0.03;
/** A longer frame than this (a hidden tab coming back) is treated as this long, so nothing jumps. */
const MAX_STEP_MS = 100;
const NOTICE_MS = 2400;
const LINE_ON_WALK = 0.4;

export interface Body {
  readonly position: Vec2;
  readonly yaw: number;
  readonly speed: number;
  /** Distance walked so far (plus a little per turn): drives the leg cycle, so the feet never slide. */
  readonly travelled: number;
  /** 0..1: how much the legs are stepping (walking or turning on the spot). */
  readonly stepping: number;
}

export type Phase =
  | { readonly kind: 'pausing'; readonly until: number }
  | {
      readonly kind: 'walking';
      readonly activity: ActivityId | null;
      readonly goal: Spot;
      readonly route: readonly Vec2[];
      readonly hurry: boolean;
    }
  | { readonly kind: 'turning'; readonly activity: ActivityId | null; readonly goal: Spot; readonly hurry: boolean }
  | { readonly kind: 'performing'; readonly activity: ActivityId; readonly startedAt: number; readonly endsAt: number; readonly midSaid: boolean }
  | { readonly kind: 'held'; readonly goal: Spot };

export interface BrainState {
  readonly body: Body;
  readonly phase: Phase;
  readonly previous: ActivityId | null;
  /** A scene to favour next (the player just tapped its prop). */
  readonly preferred: ActivityId | null;
  /** Something the character turns its head to look at, until a time. */
  readonly notice: { readonly at: Vec2; readonly until: number } | null;
}

export type BrainEvent =
  | { readonly kind: 'say'; readonly topic: BubbleTopic; readonly index: BubbleIndex }
  | { readonly kind: 'begin'; readonly activity: ActivityId; readonly atMs: number }
  | { readonly kind: 'arrived' };

export interface BrainContext {
  readonly map: YardMap;
  readonly random: Random;
}

export interface BrainStep {
  readonly state: BrainState;
  readonly events: readonly BrainEvent[];
}

export function createBrain(start: Spot, nowMs: number): BrainState {
  return {
    body: { position: { x: start.x, z: start.z }, yaw: start.yaw, speed: 0, travelled: 0, stepping: 0 },
    phase: { kind: 'pausing', until: nowMs + 1500 },
    previous: null,
    preferred: null,
    notice: null,
  };
}

const say = (topic: BubbleTopic, random: Random): BrainEvent => ({ kind: 'say', topic, index: pickLine(random) });

/** Where a scene happens: its named spot, or an open point at least a few steps away, facing about the camera. */
function goalFor(activity: ActivityId, from: Vec2, ctx: BrainContext): Spot {
  const spec = ACTIVITY_SPECS[activity];
  if (spec.spot !== 'wander') return ctx.map.spots[spec.spot];
  const far = ctx.map.wanderPoints.filter((point) => distance(point, from) > 1.2);
  const choices = far.length > 0 ? far : ctx.map.wanderPoints;
  const point = choices[Math.min(choices.length - 1, Math.floor(ctx.random() * choices.length))] ?? from;
  return { x: point.x, z: point.z, yaw: (ctx.random() - 0.5) * 0.8 };
}

function startWalk(state: BrainState, activity: ActivityId | null, goal: Spot, hurry: boolean, ctx: BrainContext): Phase {
  if (distance(state.body.position, goal) <= ARRIVED) return { kind: 'turning', activity, goal, hurry };
  return { kind: 'walking', activity, goal, route: ctx.map.route(state.body.position, goal), hurry };
}

function settle(body: Body, dtS: number): Body {
  return { ...body, speed: Math.max(0, body.speed - ACCELERATION * 2 * dtS), stepping: Math.max(0, body.stepping - dtS * 4) };
}

/** One step along the route: turn towards the next corner, speed up once roughly facing it, slow down for turns. */
function walk(body: Body, route: readonly Vec2[], hurry: boolean, dtS: number): { body: Body; route: readonly Vec2[] } {
  const target = route[0];
  if (!target) return { body, route };
  const desired = yawTowards(body.position, target, body.yaw);
  const yaw = turnTowards(body.yaw, desired, (hurry ? HURRY_TURN_RATE : TURN_RATE) * dtS);
  const facing = Math.cos(wrapAngle(desired - yaw));
  const top = hurry ? HURRY_SPEED : WALK_SPEED;
  const wanted = top * Math.max(0, Math.min(1, (facing - 0.3) / 0.7));
  const speed = body.speed < wanted ? Math.min(wanted, body.speed + ACCELERATION * dtS) : Math.max(wanted, body.speed - ACCELERATION * 2 * dtS);
  const position = stepTowards(body.position, target, speed * dtS);
  const moved = distance(body.position, position);
  const turned = Math.abs(wrapAngle(yaw - body.yaw));
  const next: Body = { position, yaw, speed, travelled: body.travelled + moved + turned * 0.12, stepping: Math.min(1, Math.max(speed / WALK_SPEED, turned > 1e-4 ? 0.6 : 0)) };
  return { body: next, route: distance(position, target) <= ARRIVED ? route.slice(1) : route };
}

export function stepBrain(state: BrainState, nowMs: number, deltaMs: number, ctx: BrainContext): BrainStep {
  const dtS = Math.max(0, Math.min(deltaMs, MAX_STEP_MS)) / 1000;
  const events: BrainEvent[] = [];
  const notice = state.notice && nowMs < state.notice.until ? state.notice : null;
  const phase = state.phase;

  switch (phase.kind) {
    case 'pausing': {
      if (nowMs < phase.until) return { state: { ...state, notice, body: settle(state.body, dtS) }, events };
      const activity = pickActivity(ctx.random, state.previous, state.preferred);
      const goal = goalFor(activity, state.body.position, ctx);
      if (ctx.random() < LINE_ON_WALK) events.push(say(ctx.random() < 0.5 ? 'walk' : 'karma', ctx.random));
      return { state: { ...state, notice, preferred: null, phase: startWalk(state, activity, goal, false, ctx) }, events };
    }
    case 'walking': {
      const moved = walk(state.body, phase.route, phase.hurry, dtS);
      const next: Phase = moved.route.length > 0 ? { ...phase, route: moved.route } : { kind: 'turning', activity: phase.activity, goal: phase.goal, hurry: phase.hurry };
      return { state: { ...state, notice, body: moved.body, phase: next }, events };
    }
    case 'turning': {
      const body = state.body;
      const yaw = turnTowards(body.yaw, phase.goal.yaw, (phase.hurry ? HURRY_TURN_RATE : TURN_RATE) * dtS);
      const turned = Math.abs(wrapAngle(yaw - body.yaw));
      const position = { x: phase.goal.x, z: phase.goal.z };
      const turning: Body = { position, yaw, speed: 0, travelled: body.travelled + turned * 0.12, stepping: turned > 1e-4 ? 0.6 : Math.max(0, body.stepping - dtS * 4) };
      if (Math.abs(wrapAngle(phase.goal.yaw - yaw)) > FACING) return { state: { ...state, notice, body: turning }, events };
      const settled: Body = { ...turning, yaw: phase.goal.yaw };
      if (phase.activity === null) {
        events.push({ kind: 'arrived' });
        return { state: { ...state, notice, body: settled, phase: { kind: 'held', goal: phase.goal } }, events };
      }
      events.push({ kind: 'begin', activity: phase.activity, atMs: nowMs }, say(phase.activity, ctx.random));
      const endsAt = nowMs + pickDuration(ctx.random, phase.activity);
      return { state: { ...state, notice, body: settled, phase: { kind: 'performing', activity: phase.activity, startedAt: nowMs, endsAt, midSaid: false } }, events };
    }
    case 'performing': {
      const body = settle(state.body, dtS);
      if (nowMs >= phase.endsAt) {
        const until = nowMs + 700 + ctx.random() * 900;
        return { state: { ...state, notice, body, previous: phase.activity, phase: { kind: 'pausing', until } }, events };
      }
      if (!phase.midSaid && ACTIVITY_SPECS[phase.activity].midLine && nowMs >= (phase.startedAt + phase.endsAt) / 2) {
        events.push(say(phase.activity, ctx.random));
        return { state: { ...state, notice, body, phase: { ...phase, midSaid: true } }, events };
      }
      return { state: { ...state, notice, body }, events };
    }
    case 'held':
      return { state: { ...state, notice, body: settle(state.body, dtS) }, events };
  }
}

/** A play mode calls: hurry to its spot and stay there (no scene of its own) until released. */
export function summonTo(state: BrainState, goal: Spot, ctx: BrainContext): BrainState {
  if (state.phase.kind === 'held' && distance(state.phase.goal, goal) < ARRIVED && Math.abs(wrapAngle(state.phase.goal.yaw - goal.yaw)) < FACING) return state;
  return { ...state, notice: null, phase: startWalk(state, null, goal, true, ctx) };
}

/** Back in the yard after a play mode: a happy word, a short breath, then the next scene. */
export function releaseToYard(state: BrainState, nowMs: number, ctx: BrainContext): BrainStep {
  if (state.phase.kind !== 'held' && !(state.phase.kind === 'walking' && state.phase.activity === null) && !(state.phase.kind === 'turning' && state.phase.activity === null)) {
    return { state, events: [] };
  }
  return { state: { ...state, phase: { kind: 'pausing', until: nowMs + 1200 } }, events: [say('welcome', ctx.random)] };
}

/** The player tapped a prop in the yard: look at it and say something; `preferred` becomes likelier next. */
export function noticeAt(state: BrainState, at: Vec2, preferred: ActivityId | null, nowMs: number, ctx: BrainContext): BrainStep {
  if (state.phase.kind === 'held') return { state, events: [] };
  return { state: { ...state, preferred: preferred ?? state.preferred, notice: { at, until: nowMs + NOTICE_MS } }, events: [say('notice', ctx.random)] };
}

/** The scene being played right now, if any. */
export function currentActivity(state: BrainState): { activity: ActivityId; startedAt: number } | null {
  return state.phase.kind === 'performing' ? { activity: state.phase.activity, startedAt: state.phase.startedAt } : null;
}
