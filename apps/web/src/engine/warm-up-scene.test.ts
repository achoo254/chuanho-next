import { describe, expect, it, vi } from 'vitest';
import { MAX_HELD_FRAMES, createRenderGuard } from './warm-up-scene';

describe('render guard', () => {
  it('never asks the scene while disarmed', () => {
    const isReady = vi.fn(() => false);
    const guard = createRenderGuard(isReady);
    expect([guard.canDraw(), guard.canDraw()]).toEqual([true, true]);
    expect(isReady).not.toHaveBeenCalled();
  });

  it('holds frames after arming until the scene is ready, then disarms', () => {
    let ready = false;
    const isReady = vi.fn(() => ready);
    const guard = createRenderGuard(isReady);
    guard.arm();
    expect([guard.canDraw(), guard.canDraw()]).toEqual([false, false]);
    ready = true;
    expect(guard.canDraw()).toBe(true);
    ready = false;
    expect(guard.canDraw()).toBe(true);
    expect(isReady).toHaveBeenCalledTimes(3);
  });

  it('draws anyway once the budget is spent, and stays disarmed', () => {
    const isReady = vi.fn(() => false);
    const guard = createRenderGuard(isReady);
    guard.arm();
    const frames = Array.from({ length: MAX_HELD_FRAMES + 3 }, () => guard.canDraw());
    expect(frames.filter((drawn) => !drawn)).toHaveLength(MAX_HELD_FRAMES);
    expect(frames.slice(MAX_HELD_FRAMES)).toEqual([true, true, true]);
    expect(isReady).toHaveBeenCalledTimes(MAX_HELD_FRAMES);
  });
});
