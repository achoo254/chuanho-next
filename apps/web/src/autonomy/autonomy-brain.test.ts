import { describe, expect, it } from 'vitest';
import { ACTIVITIES, type ActivityId } from './autonomy-activities';
import { type BrainContext, type BrainEvent, type BrainState, HURRY_SPEED, WALK_SPEED, createBrain, noticeAt, releaseToYard, stepBrain, summonTo } from './autonomy-brain';
import { seededRandom } from './seeded-random';
import { distance } from './yard-geometry';
import { createYardMap } from './yard-map';

const FRAME_MS = 1000 / 60;
const map = createYardMap();

function context(seed: number): BrainContext {
  return { map, random: seededRandom(seed) };
}

/** Runs the brain for `ms` at 60 fps, checking that the body never jumps; returns the final state and all events. */
function run(state: BrainState, from: number, ms: number, ctx: BrainContext, maxSpeed = WALK_SPEED): { state: BrainState; events: BrainEvent[]; now: number } {
  const events: BrainEvent[] = [];
  let current = state;
  let now = from;
  for (let t = 0; t < ms; t += FRAME_MS) {
    now += FRAME_MS;
    const step = stepBrain(current, now, FRAME_MS, ctx);
    // Never a jump: at most one frame's walk, plus the last two centimetres of snapping onto a spot.
    expect(distance(current.body.position, step.state.body.position)).toBeLessThanOrEqual(maxSpeed * (FRAME_MS / 1000) + 0.02 + 1e-9);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events, now };
}

describe('the character on its own', () => {
  it('keeps busy: plays every kind of scene within a long stretch, with short breaks only', () => {
    const ctx = context(11);
    let state = createBrain(map.spots.mo, 0);
    let now = 0;
    let longestPause = 0;
    let pauseStart: number | null = null;
    const begun = new Set<ActivityId>();
    for (let t = 0; t < 30 * 60_000; t += FRAME_MS) {
      now += FRAME_MS;
      const step = stepBrain(state, now, FRAME_MS, ctx);
      for (const event of step.events) if (event.kind === 'begin') begun.add(event.activity);
      if (step.state.phase.kind === 'pausing') pauseStart ??= now;
      else if (pauseStart !== null) {
        longestPause = Math.max(longestPause, now - pauseStart);
        pauseStart = null;
      }
      state = step.state;
    }
    expect([...begun].sort()).toEqual([...ACTIVITIES].sort());
    expect(longestPause).toBeLessThan(2000);
  });

  it('arrives exactly on a scene’s spot, facing its way, before the scene begins', () => {
    const ctx = context(5);
    let state = createBrain(map.spots.mo, 0);
    let now = 0;
    let checked = 0;
    for (let t = 0; t < 10 * 60_000 && checked < 12; t += FRAME_MS) {
      now += FRAME_MS;
      const step = stepBrain(state, now, FRAME_MS, ctx);
      const begin = step.events.find((event) => event.kind === 'begin');
      if (begin?.kind === 'begin' && begin.activity === 'knock') {
        expect(step.state.body.position).toEqual({ x: map.spots.mo.x, z: map.spots.mo.z });
        expect(step.state.body.yaw).toBe(map.spots.mo.yaw);
        checked += 1;
      }
      if (begin) expect(step.state.body.speed).toBe(0);
      state = step.state;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('says a line as each scene begins', () => {
    const { events } = run(createBrain(map.spots.mo, 0), 0, 60_000, context(2));
    const begins = events.filter((event) => event.kind === 'begin').length;
    const lines = events.filter((event) => event.kind === 'say' && ACTIVITIES.includes(event.topic as ActivityId)).length;
    expect(begins).toBeGreaterThan(2);
    expect(lines).toBeGreaterThanOrEqual(begins);
  });

  it('treats a long frame (a hidden tab) as a short one instead of jumping', () => {
    const ctx = context(9);
    const walking = run(createBrain(map.spots.mo, 0), 0, 3000, ctx).state;
    const step = stepBrain(walking, 3000 + 60_000, 60_000, ctx);
    expect(distance(walking.body.position, step.state.body.position)).toBeLessThanOrEqual(HURRY_SPEED * 0.1);
  });
});

describe('play modes and taps', () => {
  it('hurries to the play spot when summoned, holds there, and resumes with a welcome line', () => {
    const ctx = context(4);
    const roaming = run(createBrain(map.spots.mo, 0), 0, 20_000, ctx);
    const summoned = summonTo(roaming.state, map.spots.mo, ctx);
    const held = run(summoned, roaming.now, 8000, ctx, HURRY_SPEED);
    expect(held.state.phase.kind).toBe('held');
    expect(held.state.body.position).toEqual({ x: map.spots.mo.x, z: map.spots.mo.z });
    expect(held.state.body.yaw).toBe(map.spots.mo.yaw);
    expect(held.events.some((event) => event.kind === 'arrived')).toBe(true);

    const back = releaseToYard(held.state, held.now, ctx);
    expect(back.state.phase.kind).toBe('pausing');
    expect(back.events).toEqual([expect.objectContaining({ kind: 'say', topic: 'welcome' })]);
    const later = run(back.state, held.now, 15_000, ctx);
    expect(later.events.some((event) => event.kind === 'begin')).toBe(true);
  });

  it('does not repeat a summon to the spot it already holds', () => {
    const ctx = context(1);
    const held = run(summonTo(createBrain(map.spots.mo, 0), map.spots.mo, ctx), 0, 2000, ctx, HURRY_SPEED).state;
    expect(summonTo(held, map.spots.mo, ctx)).toBe(held);
  });

  it('ignores a release while roaming (only a play mode hands it back)', () => {
    const ctx = context(1);
    const state = createBrain(map.spots.mo, 0);
    expect(releaseToYard(state, 0, ctx)).toEqual({ state, events: [] });
  });

  it('looks at a tapped prop, says something, and favours that prop’s scene next', () => {
    const ctx = context(8);
    const state = createBrain(map.spots.mo, 0);
    const tapped = noticeAt(state, { x: 2, z: 0 }, 'bell', 100, ctx);
    expect(tapped.state.notice?.at).toEqual({ x: 2, z: 0 });
    expect(tapped.state.preferred).toBe('bell');
    expect(tapped.events).toEqual([expect.objectContaining({ kind: 'say', topic: 'notice' })]);
    const after = run(tapped.state, 100, 3000, ctx).state;
    expect(after.notice).toBeNull();
  });

  it('does not chatter about taps while a play mode holds it', () => {
    const ctx = context(8);
    const held = run(summonTo(createBrain(map.spots.mo, 0), map.spots.mo, ctx), 0, 1000, ctx, HURRY_SPEED).state;
    expect(noticeAt(held, { x: 0, z: 0 }, null, 2000, ctx).events).toEqual([]);
  });
});
