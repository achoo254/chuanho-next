/**
 * "Chạy khi PC rảnh, nhường GPU": the pure decision of whether the next GPU step may start.
 *
 * Order: the daily window, then the GPU (one busy sample means "look again soon"; `busySamples` busy samples in a
 * row mean another session is working, so pause with a growing back-off), then ComfyUI's queue (anything queued
 * while this runner is between steps belongs to someone else), and only then artgen `--health`, which is the slowest
 * probe and is reused for `healthTtlMs` after a success. Any refusal leaves the state ready for the next sample;
 * a `go` resets the back-off.
 */
import type { GpuSample } from './gpu-probes';

export interface GateSettings {
  readonly busyPercent: number;
  readonly busySamples: number;
  /** 0 disables the free-memory check. */
  readonly minFreeMiB: number;
  readonly sampleMs: number;
  readonly minPauseMs: number;
  readonly maxPauseMs: number;
  readonly healthTtlMs: number;
}

export interface GateState {
  readonly busyStreak: number;
  /** Back-off for the next pause. */
  readonly pauseMs: number;
  /** Time (ms) of the last successful health probe. */
  readonly healthOkAt?: number;
}

export interface GateObservation {
  readonly nowMs: number;
  /** 0 when the window is open. */
  readonly msUntilWindow: number;
  /** undefined: nvidia-smi unavailable. */
  readonly gpu: GpuSample | undefined;
  /** undefined: ComfyUI did not answer (health decides). */
  readonly comfyQueue: number | undefined;
  /** undefined: not probed in this round. */
  readonly health?: { readonly ok: boolean; readonly detail: string };
}

export type GateDecision =
  | { readonly kind: 'go' }
  | { readonly kind: 'probe-health' }
  | { readonly kind: 'wait'; readonly ms: number; readonly reason: string; readonly paused: boolean };

export function initialGateState(settings: GateSettings): GateState {
  return { busyStreak: 0, pauseMs: settings.minPauseMs };
}

export function isGpuBusy(sample: GpuSample, settings: GateSettings): boolean {
  return sample.utilPercent > settings.busyPercent || (settings.minFreeMiB > 0 && sample.freeMiB < settings.minFreeMiB);
}

function pause(state: GateState, settings: GateSettings, reason: string, extra: Partial<GateState> = {}): { state: GateState; decision: GateDecision } {
  return {
    state: { ...state, ...extra, pauseMs: Math.min(state.pauseMs * 2, settings.maxPauseMs) },
    decision: { kind: 'wait', ms: state.pauseMs, reason, paused: true },
  };
}

export function decideGate(state: GateState, settings: GateSettings, obs: GateObservation): { state: GateState; decision: GateDecision } {
  if (obs.msUntilWindow > 0) {
    // Outside the window: sleep until it opens (the back-off starts fresh then).
    return { state: { ...state, busyStreak: 0, pauseMs: settings.minPauseMs }, decision: { kind: 'wait', ms: obs.msUntilWindow, reason: 'outside the allowed window', paused: false } };
  }
  if (obs.gpu && isGpuBusy(obs.gpu, settings)) {
    const busyStreak = state.busyStreak + 1;
    const load = `GPU ${obs.gpu.utilPercent}% busy, ${obs.gpu.freeMiB} MiB free`;
    if (busyStreak >= settings.busySamples) return pause(state, settings, `${load} for ${busyStreak} samples: another session is using it`, { busyStreak });
    return { state: { ...state, busyStreak }, decision: { kind: 'wait', ms: settings.sampleMs, reason: `${load} (sample ${busyStreak}/${settings.busySamples})`, paused: false } };
  }
  const idle: GateState = { ...state, busyStreak: 0 };
  if (obs.comfyQueue !== undefined && obs.comfyQueue > 0) return pause(idle, settings, `ComfyUI has ${obs.comfyQueue} job(s) from another session`);
  const healthFresh = idle.healthOkAt !== undefined && obs.nowMs - idle.healthOkAt < settings.healthTtlMs;
  if (!healthFresh) {
    if (!obs.health) return { state: idle, decision: { kind: 'probe-health' } };
    if (!obs.health.ok) return pause(idle, settings, obs.health.detail, { healthOkAt: undefined });
    return { state: { ...idle, healthOkAt: obs.nowMs, pauseMs: settings.minPauseMs }, decision: { kind: 'go' } };
  }
  return { state: { ...idle, pauseMs: settings.minPauseMs }, decision: { kind: 'go' } };
}
