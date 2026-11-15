/**
 * What every job executor receives. Executors call `waitForGpu()` before each GPU step (one track, one picture,
 * one voice take), so a batch yields the GPU between items instead of holding it for hours.
 */
import { readFile } from 'node:fs/promises';
import type { FactoryConfig } from '../factory-config';
import type { QueueState } from '../job-store';
import type { Job, JobResult } from '../job-types';
import type { MediaLayout } from '../media-layout';
import type { RunCommand } from '../process-runner';

export interface ExecutorContext {
  readonly config: FactoryConfig;
  readonly layout: MediaLayout;
  readonly run: RunCommand;
  readonly now: () => Date;
  readonly log: (message: string) => void;
  /** Resolves true when a GPU step may start; false when the runner is stopping. */
  readonly waitForGpu: () => Promise<boolean>;
  /** Aborted on a hard stop; pass it to every command. */
  readonly signal: AbortSignal;
  /** Queue snapshot taken when the job started (inputs of earlier jobs). */
  readonly state: QueueState;
}

export interface ExecutorOutcome {
  readonly status: 'passed' | 'rejected';
  readonly result: JobResult;
}

export type Executor = (job: Job, ctx: ExecutorContext) => Promise<ExecutorOutcome>;

/** Thrown when the runner is stopping between steps; the job goes back to pending without using an attempt. */
export class StopRequested extends Error {
  constructor() {
    super('stop requested');
    this.name = 'StopRequested';
  }
}

export async function gpuStep(ctx: ExecutorContext): Promise<void> {
  if (!(await ctx.waitForGpu())) throw new StopRequested();
}

export async function readJsonIfExists(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function outcome(result: JobResult): ExecutorOutcome {
  return { status: result.qc.some((item) => item.passed) ? 'passed' : 'rejected', result };
}
