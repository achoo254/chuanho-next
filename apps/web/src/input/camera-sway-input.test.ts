import { describe, expect, it } from 'vitest';
import { FREE_PITCH_MAX, FREE_PITCH_MIN, ZOOM_MAX, ZOOM_MIN, createCameraSwayInput } from './camera-sway-input';
import { commandForKey } from './keyboard-commands';

describe('free camera', () => {
  it('orbits as the player drags and stays there', () => {
    const input = createCameraSwayInput(true);
    input.beginDrag(100, 100);
    input.dragTo(300, 100);
    input.endDrag();
    const after = input.update(16);
    expect(after.yaw).toBeGreaterThan(0.5);
    expect(input.update(5000).yaw).toBeCloseTo(after.yaw);
    expect(input.viewChanged).toBe(true);
  });

  it('keeps the tilt between its limits however far the drag goes', () => {
    const input = createCameraSwayInput(true);
    input.beginDrag(0, 0);
    input.dragTo(0, 100000);
    expect(input.update(16).pitch).toBeCloseTo(FREE_PITCH_MAX);
    input.dragTo(0, -200000);
    expect(input.update(16).pitch).toBeCloseTo(FREE_PITCH_MIN);
  });

  it('zooms in and out within the allowed range', () => {
    const input = createCameraSwayInput(true);
    input.zoomBy(0.001);
    expect(input.update(16).zoom).toBe(ZOOM_MIN);
    input.zoomBy(1e6);
    expect(input.update(16).zoom).toBe(ZOOM_MAX);
    input.zoomBy(Number.NaN);
    expect(input.update(16).zoom).toBe(ZOOM_MAX);
  });

  it('returns to the framed view on reset', () => {
    const input = createCameraSwayInput(true);
    input.beginDrag(0, 0);
    input.dragTo(80, 40);
    input.zoomBy(0.5);
    input.resetView();
    expect(input.viewChanged).toBe(false);
    expect(input.update(16)).toEqual({ yaw: 0, pitch: 0, zoom: 1 });
  });
});

describe('view keys', () => {
  it('map R to reset and plus or minus to zoom, but only when no control has focus', () => {
    expect(commandForKey('r', false)).toEqual({ kind: 'view', change: 'reset' });
    expect(commandForKey('+', false)).toEqual({ kind: 'view', change: 'in' });
    expect(commandForKey('-', false)).toEqual({ kind: 'view', change: 'out' });
    expect(commandForKey('r', true)).toBeNull();
    expect(commandForKey('1', true)).toEqual({ kind: 'action', action: 'incense' });
  });
});
