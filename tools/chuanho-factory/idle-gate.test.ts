import { describe, expect, it } from 'vitest';
import { parseComfyQueue, parseNvidiaSmi, probeComfyQueue, probeGpu, probeHealth } from './gpu-probes';
import { decideGate, initialGateState, type GateObservation, type GateSettings, type GateState } from './idle-gate';
import { formatWindow, isInsideWindow, msUntilWindowOpens, parseWindow } from './schedule-window';

const settings: GateSettings = { busyPercent: 30, busySamples: 3, minFreeMiB: 0, sampleMs: 20_000, minPauseMs: 60_000, maxPauseMs: 240_000, healthTtlMs: 300_000 };
const idle = { utilPercent: 3, freeMiB: 8000 };
const busy = { utilPercent: 95, freeMiB: 1000 };
const healthy = { ok: true, detail: 'ok' };
const obs = (extra: Partial<GateObservation> = {}): GateObservation => ({ nowMs: 1_000_000, msUntilWindow: 0, gpu: idle, comfyQueue: 0, ...extra });

describe('daily window', () => {
  const night = parseWindow('23:00-07:00');
  const at = (h: number, m = 0): Date => new Date(2026, 10, 15, h, m);

  it('wraps midnight', () => {
    expect(isInsideWindow(night, at(23, 30))).toBe(true);
    expect(isInsideWindow(night, at(3))).toBe(true);
    expect(isInsideWindow(night, at(7))).toBe(false);
    expect(isInsideWindow(night, at(12))).toBe(false);
    expect(isInsideWindow(parseWindow('01:00-05:00'), at(4, 59))).toBe(true);
    expect(isInsideWindow(parseWindow('00:00-00:00'), at(12))).toBe(true);
  });

  it('knows how long until it opens', () => {
    expect(msUntilWindowOpens(night, at(2))).toBe(0);
    expect(msUntilWindowOpens(night, at(22, 30))).toBe(30 * 60_000);
    expect(msUntilWindowOpens(parseWindow('01:00-05:00'), at(6))).toBe(19 * 3_600_000);
  });

  it('parses and formats HH:MM-HH:MM only', () => {
    expect(formatWindow(parseWindow('23:00-07:30'))).toBe('23:00-07:30');
    expect(() => parseWindow('25:00-07:00')).toThrow();
    expect(() => parseWindow('23:00')).toThrow();
  });
});

describe('idle gate', () => {
  it('waits for the window without probing further', () => {
    const { decision } = decideGate(initialGateState(settings), settings, obs({ msUntilWindow: 5000, gpu: busy }));
    expect(decision).toEqual({ kind: 'wait', ms: 5000, reason: 'outside the allowed window', paused: false });
  });

  it('asks for health once everything else is clear, then goes and caches the health', () => {
    let step = decideGate(initialGateState(settings), settings, obs());
    expect(step.decision.kind).toBe('probe-health');
    step = decideGate(initialGateState(settings), settings, obs({ health: healthy }));
    expect(step.decision.kind).toBe('go');
    expect(decideGate(step.state, settings, obs({ nowMs: 1_000_000 + 60_000 })).decision.kind).toBe('go');
    expect(decideGate(step.state, settings, obs({ nowMs: 1_000_000 + 400_000 })).decision.kind).toBe('probe-health');
  });

  it('never starts while health fails, backing off', () => {
    const step = decideGate(initialGateState(settings), settings, obs({ health: { ok: false, detail: 'artgen --health failed: offline' } }));
    expect(step.decision).toMatchObject({ kind: 'wait', ms: 60_000, paused: true, reason: expect.stringMatching(/offline/) });
    expect(step.state.pauseMs).toBe(120_000);
  });

  it('confirms a busy GPU over N samples before pausing, and backs off up to the cap', () => {
    let state: GateState = initialGateState(settings);
    const decisions: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const step = decideGate(state, settings, obs({ gpu: busy }));
      state = step.state;
      decisions.push(step.decision.kind === 'wait' ? `${step.decision.paused ? 'pause' : 'sample'}:${step.decision.ms}` : step.decision.kind);
    }
    expect(decisions).toEqual(['sample:20000', 'sample:20000', 'pause:60000', 'pause:120000', 'pause:240000', 'pause:240000']);
    // The GPU frees up: the streak and the back-off reset.
    const resumed = decideGate(state, settings, obs({ health: healthy }));
    expect(resumed.decision.kind).toBe('go');
    expect(resumed.state).toMatchObject({ busyStreak: 0, pauseMs: 60_000 });
  });

  it('one quiet sample resets the busy streak', () => {
    let state = decideGate(initialGateState(settings), settings, obs({ gpu: busy })).state;
    state = decideGate(state, settings, obs({ gpu: busy })).state;
    state = decideGate(state, settings, obs({ health: healthy })).state;
    expect(decideGate(state, settings, obs({ gpu: busy })).decision).toMatchObject({ paused: false });
  });

  it('pauses when ComfyUI holds jobs of another session, and on low free VRAM when configured', () => {
    expect(decideGate(initialGateState(settings), settings, obs({ comfyQueue: 2 })).decision).toMatchObject({ kind: 'wait', paused: true, reason: expect.stringMatching(/2 job/) });
    const strict = { ...settings, minFreeMiB: 4000, busySamples: 1 };
    expect(decideGate(initialGateState(strict), strict, obs({ gpu: { utilPercent: 0, freeMiB: 2000 } })).decision).toMatchObject({ paused: true });
  });

  it('without nvidia-smi it relies on the queue and health', () => {
    expect(decideGate(initialGateState(settings), settings, obs({ gpu: undefined, health: healthy })).decision.kind).toBe('go');
  });
});

describe('probes', () => {
  it('parses nvidia-smi across GPUs', () => {
    expect(parseNvidiaSmi('5, 9877, 16303\r\n')).toEqual({ utilPercent: 5, freeMiB: 6426 });
    expect(parseNvidiaSmi('5, 1000, 8000\n80, 7000, 8000\n')).toEqual({ utilPercent: 80, freeMiB: 1000 });
    expect(parseNvidiaSmi('NVIDIA-SMI has failed')).toBeUndefined();
  });

  it('treats a missing nvidia-smi as unknown', async () => {
    await expect(probeGpu(() => Promise.reject(new Error('ENOENT')))).resolves.toBeUndefined();
    await expect(probeGpu(() => Promise.resolve({ code: 0, stdout: '12, 100, 200', stderr: '' }))).resolves.toEqual({ utilPercent: 12, freeMiB: 100 });
  });

  it('reads the ComfyUI queue', async () => {
    expect(parseComfyQueue({ queue_running: [[1]], queue_pending: [[2], [3]] })).toBe(3);
    expect(parseComfyQueue({ error: 'x' })).toBeUndefined();
    await expect(probeComfyQueue('http://comfy', (url) => Promise.resolve(url.endsWith('/queue') ? { queue_running: [], queue_pending: [] } : {}))).resolves.toBe(0);
    await expect(probeComfyQueue('http://comfy', () => Promise.reject(new Error('refused')))).resolves.toBeUndefined();
  });

  it('reads artgen --health', async () => {
    const reply = (code: number, stdout: string) => () => Promise.resolve({ code, stdout, stderr: '' });
    await expect(probeHealth(reply(0, 'noise\n{"ok": true, "comfyui": "0.42"}\n'), 'py', 'dir')).resolves.toMatchObject({ ok: true });
    await expect(probeHealth(reply(1, '{"ok": false, "error": "PC offline"}'), 'py', 'dir')).resolves.toMatchObject({ ok: false, detail: expect.stringMatching(/PC offline/) });
    await expect(probeHealth(() => Promise.reject(new Error('no python')), 'py', 'dir')).resolves.toMatchObject({ ok: false });
  });
});
