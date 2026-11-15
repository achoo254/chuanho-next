import { describe, expect, it } from 'vitest';
import { StopRequested, type Executor } from './executors/executor-context';
import type { FactoryConfig } from './factory-config';
import { FactoryRunner, type RunnerClock, type RunnerOptions, type RunnerProbes, type RunnerStore } from './factory-runner';
import type { GpuSample } from './gpu-probes';
import { createJob } from './job-queue';
import { parseState, serializeLine, type QueueState } from './job-store';
import { JOB_KINDS, type Job, type JobKind, type JobParams } from './job-types';
import { mediaLayout } from './media-layout';
import { parseWindow } from './schedule-window';

/** A clock whose sleep advances time instantly and records each wait. */
function fakeClock(start: Date): RunnerClock & { sleeps: number[] } {
  let now = start.getTime();
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => new Date(now),
    sleep: (ms) => {
      sleeps.push(ms);
      now += ms;
      return Promise.resolve();
    },
  };
}

/** The real line format, kept in memory. */
function memoryStore(jobs: Job[]): RunnerStore & { text: string } {
  const store = {
    text: jobs.map((job) => serializeLine({ type: 'job', job })).join(''),
    load: (): Promise<QueueState> => Promise.resolve(parseState(store.text)),
    saveJob: (job: Job): Promise<void> => {
      store.text += serializeLine({ type: 'job', job });
      return Promise.resolve();
    },
    compactIfNeeded: (): Promise<boolean> => Promise.resolve(false),
  };
  return store;
}

function probes(gpu: (GpuSample | undefined)[], options: { queue?: number[]; health?: boolean[] } = {}): RunnerProbes & { healthCalls: number } {
  let g = 0;
  let q = 0;
  let h = 0;
  const p = {
    healthCalls: 0,
    gpu: () => Promise.resolve(gpu[Math.min(g++, gpu.length - 1)]),
    comfyQueue: () => Promise.resolve(options.queue ? options.queue[Math.min(q++, options.queue.length - 1)] : 0),
    health: () => {
      p.healthCalls += 1;
      const ok = options.health ? (options.health[Math.min(h++, options.health.length - 1)] ?? true) : true;
      return Promise.resolve({ ok, detail: ok ? 'ok' : 'artgen --health failed: offline' });
    },
  };
  return p;
}

const IDLE = { utilPercent: 2, freeMiB: 9000 };
const BUSY = { utilPercent: 97, freeMiB: 500 };
const t0 = new Date(2026, 10, 15, 23, 30); // inside 23:00-07:00
const passing: Executor = () => Promise.resolve({ status: 'passed', result: { outputs: [], qc: [], summary: {} } });

function setup(jobs: JobParams[], overrides: Partial<RunnerOptions> & { executor?: Executor } = {}) {
  const clock = overrides.clock ?? fakeClock(t0);
  const store = memoryStore(jobs.map((params, i) => createJob(`job-${i}`, params, new Date(t0.getTime() + i), 2)));
  const logs: string[] = [];
  const executor = overrides.executor ?? passing;
  const executors = Object.fromEntries(JOB_KINDS.map((kind) => [kind, executor])) as Record<JobKind, Executor>;
  const runner = new FactoryRunner({
    store,
    executors,
    probes: probes([IDLE]),
    clock,
    settings: { busyPercent: 30, busySamples: 3, minFreeMiB: 0, sampleMs: 20_000, minPauseMs: 60_000, maxPauseMs: 600_000, healthTtlMs: 300_000 },
    window: parseWindow('23:00-07:00'),
    ignoreWindow: false,
    once: false,
    log: (m) => logs.push(m),
    context: { config: {} as FactoryConfig, layout: mediaLayout('media'), run: () => Promise.reject(new Error('no commands in tests')) },
    ...overrides,
  });
  return { runner, store, logs, clock };
}

const statuses = async (store: RunnerStore): Promise<string[]> => (await store.load()).jobs.map((j) => `${j.id}:${j.status}:${j.attempts}`).sort();

describe('factory runner', () => {
  it('runs every pending job once, in pipeline order, then stops', async () => {
    const order: string[] = [];
    const { runner, store } = setup([{ kind: 'publish-library' }, { kind: 'music', count: 1 }, { kind: 'beatmap' }], {
      executor: (job) => {
        order.push(job.params.kind);
        return passing(job, {} as never);
      },
    });
    expect(await runner.run()).toMatchObject({ started: 3, passed: 3 });
    expect(order).toEqual(['music', 'beatmap', 'publish-library']);
    expect(await statuses(store)).toEqual(['job-0:passed:1', 'job-1:passed:1', 'job-2:passed:1']);
  });

  it('sleeps until the window opens before starting', async () => {
    const clock = fakeClock(new Date(2026, 10, 15, 21, 0));
    const { runner } = setup([{ kind: 'beatmap' }], { clock });
    await runner.run();
    expect(clock.sleeps[0]).toBe(2 * 3_600_000);
  });

  it('pauses while another session keeps the GPU busy, then resumes', async () => {
    const clock = fakeClock(t0);
    const { runner, logs } = setup([{ kind: 'scene', times: ['night'] }], { clock, probes: probes([BUSY, BUSY, BUSY, BUSY, IDLE]) });
    expect(await runner.run()).toMatchObject({ passed: 1 });
    expect(clock.sleeps).toEqual([20_000, 20_000, 60_000, 120_000]);
    expect(logs.some((l) => l.startsWith('paused: GPU 97% busy'))).toBe(true);
  });

  it('pauses on a foreign ComfyUI queue and never starts while health fails', async () => {
    const p = probes([IDLE], { queue: [1, 0], health: [false, false, true] });
    const clock = fakeClock(t0);
    const { runner } = setup([{ kind: 'beatmap' }], { clock, probes: p });
    await runner.run();
    expect(clock.sleeps).toEqual([60_000, 120_000, 240_000]);
    expect(p.healthCalls).toBe(3);
  });

  it('retries a failing job up to the cap, then marks it failed', async () => {
    let calls = 0;
    const { runner, store } = setup([{ kind: 'video', seconds: 30, withVoice: false }], {
      executor: () => {
        calls += 1;
        return Promise.reject(new Error('no passed scene picture'));
      },
    });
    expect(await runner.run()).toMatchObject({ started: 2, failed: 1 });
    expect(calls).toBe(2);
    const [job] = (await store.load()).jobs;
    expect(job).toMatchObject({ status: 'failed', attempts: 2, lastError: 'no passed scene picture' });
  });

  it('never runs two jobs at once and calls the gate before each GPU step', async () => {
    let active = 0;
    let maxActive = 0;
    const executor: Executor = async (job, ctx) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      expect(await ctx.waitForGpu()).toBe(true);
      await Promise.resolve();
      active -= 1;
      return passing(job, ctx);
    };
    const { runner } = setup([{ kind: 'beatmap' }, { kind: 'beatmap' }, { kind: 'beatmap' }], { executor });
    const first = runner.run();
    await expect(runner.run()).rejects.toThrow(/already running/);
    expect(await first).toMatchObject({ started: 3, passed: 3 });
    expect(maxActive).toBe(1);
  });

  it('a stop request puts the running job back to pending without using an attempt', async () => {
    const ref: { runner?: FactoryRunner } = {};
    const executor: Executor = async (_job, ctx) => {
      ref.runner?.requestStop();
      if (!(await ctx.waitForGpu())) throw new StopRequested();
      throw new Error('unreachable');
    };
    const { runner, store } = setup([{ kind: 'music', count: 2 }, { kind: 'beatmap' }], { executor });
    ref.runner = runner;
    expect(await runner.run()).toMatchObject({ started: 1, interrupted: 1 });
    expect(await statuses(store)).toEqual(['job-0:pending:0', 'job-1:pending:0']);
  });

  it('recovers a job left running by a crash as a used attempt', async () => {
    const { runner, store } = setup([]);
    await store.saveJob({ ...createJob('crashed', { kind: 'beatmap' }, t0, 1), status: 'running', attempts: 1 });
    await runner.run();
    expect(await statuses(store)).toEqual(['crashed:failed:1']);
  });

  it('with --once runs a single job', async () => {
    const { runner } = setup([{ kind: 'beatmap' }, { kind: 'beatmap' }], { once: true });
    expect(await runner.run()).toMatchObject({ started: 1 });
  });
});
