import { describe, expect, it } from 'vitest';
import { JOINT_LIMITS } from './character-poses';
import type { ArmAngles } from './strike-reach';
import {
  STRIKE_CONTACT_MS,
  STRIKE_DURATION_MS,
  STRIKE_KEYS,
  bodySquashAt,
  crossedContact,
  isHappyFaceAt,
  moSquashAt,
  restartStrike,
  strikeArmAt,
  strikeElapsed,
  strikeKeyPoses,
} from './strike-timeline';

const CONTACT: ArmAngles = { yaw: 0.4, upper: 1.5, elbow: -0.3 };
const keys = strikeKeyPoses(CONTACT);

function expectArm(actual: ArmAngles, expected: ArmAngles): void {
  expect(actual.yaw).toBeCloseTo(expected.yaw, 9);
  expect(actual.upper).toBeCloseTo(expected.upper, 9);
  expect(actual.elbow).toBeCloseTo(expected.elbow, 9);
}

describe('strike key frames', () => {
  it('hits within 50 ms of the touch and is over in about a quarter of a second', () => {
    expect(STRIKE_CONTACT_MS).toBeLessThanOrEqual(50);
    expect(STRIKE_DURATION_MS).toBeGreaterThanOrEqual(200);
    expect(STRIKE_DURATION_MS).toBeLessThanOrEqual(260);
  });

  it('lists its keys in time order: rest, lift, hit, bounce, rest', () => {
    const times = STRIKE_KEYS.map(([time]) => time);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(STRIKE_KEYS.map(([, name]) => name)).toEqual(['ready', 'raised', 'contact', 'rebound', 'ready']);
  });

  it('is exactly at each key pose at its key time', () => {
    expectArm(strikeArmAt(keys, STRIKE_CONTACT_MS), keys.contact);
    expectArm(strikeArmAt(keys, 18), keys.raised);
    expectArm(strikeArmAt(keys, 110), keys.rebound);
    expectArm(strikeArmAt(keys, 0), keys.ready);
    expectArm(strikeArmAt(keys, STRIKE_DURATION_MS + 500), keys.ready);
  });

  it('lifts the mallet above the rest pose before swinging down', () => {
    expect(keys.raised.upper).toBeGreaterThan(keys.ready.upper);
    expect(keys.ready.upper).toBeGreaterThan(keys.contact.upper);
  });

  it('never leaves the joint limits, even from an extreme contact pose', () => {
    const extreme = strikeKeyPoses({ yaw: 3, upper: 2.8, elbow: 2.3 });
    for (let t = 0; t <= STRIKE_DURATION_MS; t += 5) {
      const arm = strikeArmAt(extreme, t);
      expect(arm.yaw).toBeLessThanOrEqual(JOINT_LIMITS.yaw[1]);
      expect(arm.upper).toBeLessThanOrEqual(JOINT_LIMITS.upper[1]);
      expect(arm.upper).toBeGreaterThanOrEqual(JOINT_LIMITS.upper[0]);
      expect(arm.elbow).toBeLessThanOrEqual(JOINT_LIMITS.elbow[1]);
      expect(arm.elbow).toBeGreaterThanOrEqual(JOINT_LIMITS.elbow[0]);
    }
  });
});

describe('squash and face', () => {
  it('squashes the wooden fish at the hit, bounces, and settles', () => {
    expect(moSquashAt(STRIKE_CONTACT_MS - 1)).toBe(1);
    expect(moSquashAt(STRIKE_CONTACT_MS)).toBeCloseTo(0.84, 6);
    for (let t = STRIKE_CONTACT_MS; t < 800; t += 7) {
      expect(moSquashAt(t)).toBeGreaterThanOrEqual(0.84 - 1e-9);
      expect(moSquashAt(t)).toBeLessThanOrEqual(1.16);
    }
    expect(Math.abs(moSquashAt(STRIKE_CONTACT_MS + 400) - 1)).toBeLessThan(0.01);
    expect(moSquashAt(STRIKE_CONTACT_MS, 0.05)).toBeCloseTo(0.95, 6);
  });

  it('bounces the body a little with the hit', () => {
    expect(bodySquashAt(0)).toBe(1);
    expect(bodySquashAt(STRIKE_CONTACT_MS)).toBeLessThan(1);
  });

  it('smiles with closed eyes from the hit for a moment', () => {
    expect(isHappyFaceAt(STRIKE_CONTACT_MS - 1)).toBe(false);
    expect(isHappyFaceAt(STRIKE_CONTACT_MS)).toBe(true);
    expect(isHappyFaceAt(STRIKE_CONTACT_MS + 1000)).toBe(false);
  });
});

describe('restarting', () => {
  it('starts over from zero on every touch instead of queueing', () => {
    let clock = restartStrike(1000);
    expect(strikeElapsed(clock, 1030)).toBe(30);
    // A second touch mid-swing: the swing begins again at once.
    clock = restartStrike(1030);
    expect(strikeElapsed(clock, 1030)).toBe(0);
    expectArm(strikeArmAt(keys, strikeElapsed(clock, 1030)), keys.ready);
  });

  it('is at rest before the first touch', () => {
    expect(strikeElapsed({ startedAt: null }, 5000)).toBe(Number.POSITIVE_INFINITY);
    expectArm(strikeArmAt(keys, Number.POSITIVE_INFINITY), keys.ready);
  });

  it('reports the hit once per strike, including after a restart', () => {
    expect(crossedContact(Number.POSITIVE_INFINITY, 16)).toBe(false);
    expect(crossedContact(32, 48)).toBe(true);
    expect(crossedContact(48, 64)).toBe(false);
    expect(crossedContact(120, 10)).toBe(false);
    expect(crossedContact(120, 50)).toBe(true);
  });
});
