/**
 * The idle-aware runner: takes the next pending job, waits at the idle gate before the job and before every GPU
 * step inside it, records each transition in the queue file, and retries failures up to the cap. One job at a time
 * by construction (a single loop, plus the lock file across processes). Clock, probes, store and executors are
 * injected, so tests drive it with fakes.
 *
 * Stopping: `requestStop()` (first SIGINT) lets the current step finish, then the job goes back to pending without
 * using an attempt; `hardStop()` (second SIGINT) also kills the command this runner started.
 */
import type { GpuSample, HealthReport } from './gpu-probes';
import { decideGate, initialGateState, type GateSettings, type GateState } from './idle-gate';
import { markFailed, markFinished, markInterrupted, markRunning, nextRetryAt, nextRunnable, recoverStale } from './job-queue';
import type { QueueState } from './job-store';
import type { Job, JobKind } from './job-types';
import { msUntilWindowOpens, type DailyWindow } from './schedule-window';
import { StopRequested, type Executor, type ExecutorContext } from './executors/executor-context';

export interface RunnerClock {
  now(): Date;
  /** Resolves after `ms` or as soon as `signal` aborts. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export interface RunnerProbes {
  gpu(): Promise<GpuSample | undefined>;
  comfyQueue(): Promise<number | undefined>;
  health(): Promise<HealthReport>;
}

export interface RunnerStore {
  load(): Promise<QueueState>;
  saveJob(job: Job): Promise<void>;
  compactIfNeeded(state: QueueState): Promise<boolean>;
}

export interface RunnerOptions {
  readonly store: RunnerStore;
  readonly executors: Readonly<Record<JobKind, Executor>>;
  readonly probes: RunnerProbes;
  readonly clock: RunnerClock;
  readonly settings: GateSettings;
  readonly window: DailyWindow;
  readonly ignoreWindow: boolean;
  /** Run at most one job, then return. */
  readonly once: boolean;
  readonly log: (message: string) => void;
  /** Everything an executor needs besides what the runner supplies. */
  readonly context: Omit<ExecutorContext, 'waitForGpu' | 'signal' | 'state' | 'log' | 'now'>;
}

export interface RunSummary {
  readonly started: number;
  readonly passed: number;
  readonly rejected: number;
  readonly failed: number;
  readonly interrupted: number;
}

export const realClock: RunnerClock = {
  now: () => new Date(),
  sleep: (ms, signal) =>
    new Promise((resolve) => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(done, ms);
      function done(): void {
        clearTimeout(timer);
        signal.removeEventListener('abort', done);
        resolve();
      }
      signal.addEventListener('abort', done, { once: true });
    }),
};

export class FactoryRunner {
  private readonly stop = new AbortController();
  private readonly kill = new AbortController();
  private gate: GateState;
  private lastWaitReason = '';
  private busy = false;

  constructor(private readonly options: RunnerOptions) {
    this.gate = initialGateState(options.settings);
  }

  requestStop(): void {
    this.stop.abort();
  }

  hardStop(): void {
    this.stop.abort();
    this.kill.abort();
  }

  get stopping(): boolean {
    return this.stop.signal.aborted;
  }

  /** Waits until the window is open, the GPU idle, ComfyUI free and artgen healthy; false when stopping. */
  async waitForGpu(): Promise<boolean> {
    const { probes, clock, settings } = this.options;
    while (!this.stopping) {
      const now = clock.now();
      const msUntilWindow = this.options.ignoreWindow ? 0 : msUntilWindowOpens(this.options.window, now);
      const open = msUntilWindow === 0;
      const obs = { nowMs: now.getTime(), msUntilWindow, gpu: open ? await probes.gpu() : undefined, comfyQueue: open ? await probes.comfyQueue() : undefined };
      let step = decideGate(this.gate, settings, obs);
      if (step.decision.kind === 'probe-health') step = decideGate(this.gate, settings, { ...obs, health: await probes.health() });
      this.gate = step.state;
      const decision = step.decision;
      if (decision.kind === 'go') {
        this.lastWaitReason = '';
        return true;
      }
      if (decision.kind === 'wait') {
        if (decision.reason !== this.lastWaitReason) this.options.log(`${decision.paused ? 'paused' : 'waiting'}: ${decision.reason} (next look in ${Math.round(decision.ms / 1000)} s)`);
        this.lastWaitReason = decision.reason;
        await clock.sleep(decision.ms, this.stop.signal);
      }
    }
    return false;
  }

  async run(): Promise<RunSummary> {
    if (this.busy) throw new Error('runner is already running');
    this.busy = true;
    const counts = { started: 0, passed: 0, rejected: 0, failed: 0, interrupted: 0 };
    const { store, clock, log } = this.options;
    try {
      const initial = await store.load();
      for (const job of recoverStale(initial.jobs, clock.now())) {
        log(`${job.id}: recovered from an interrupted run (${job.status})`);
        await store.saveJob(job);
      }
      await store.compactIfNeeded(await store.load());
      while (!this.stopping) {
        const state = await store.load(); // re-read: `enqueue` and `reject` may have appended meanwhile
        const job = nextRunnable(state.jobs, clock.now());
        if (!job) {
          const retryAt = nextRetryAt(state.jobs);
          if (!retryAt) break;
          log(`waiting for a retry at ${retryAt.toISOString()}`);
          await clock.sleep(Math.max(1000, retryAt.getTime() - clock.now().getTime()), this.stop.signal);
          continue;
        }
        if (!(await this.waitForGpu())) break;
        await this.runOne(job, state, counts);
        if (this.options.once) break;
      }
    } finally {
      this.busy = false;
    }
    return counts;
  }

  private async runOne(job: Job, state: QueueState, counts: { -readonly [K in keyof RunSummary]: number }): Promise<void> {
    const { store, clock, log, executors } = this.options;
    const running = markRunning(job, clock.now());
    await store.saveJob(running);
    counts.started += 1;
    log(`${running.id}: start (attempt ${running.attempts}/${running.maxAttempts})`);
    const ctx: ExecutorContext = {
      ...this.options.context,
      state,
      log: (message) => log(`${running.id}: ${message}`),
      now: () => clock.now(),
      waitForGpu: () => this.waitForGpu(),
      signal: this.kill.signal,
    };
    try {
      const { status, result } = await executors[running.params.kind](running, ctx);
      await store.saveJob(markFinished(running, clock.now(), result, status));
      counts[status] += 1;
      log(`${running.id}: ${status} ${JSON.stringify(result.summary)}`);
    } catch (error) {
      if (error instanceof StopRequested || this.stopping) {
        await store.saveJob(markInterrupted(running, clock.now()));
        counts.interrupted += 1;
        log(`${running.id}: stopped, back to pending`);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      const next = markFailed(running, clock.now(), message);
      await store.saveJob(next);
      if (next.status === 'failed') counts.failed += 1;
      log(`${running.id}: ${next.status === 'failed' ? 'failed for good' : `failed, retry after ${next.notBefore}`}: ${message}`);
    }
  }
}
