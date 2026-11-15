/**
 * Pure queue logic: job creation, the next job to run, and every status transition. No I/O, no clock of its own
 * (callers pass `now`), so the runner's behaviour is fully testable.
 */
import { JOB_KINDS, type Job, type JobParams, type JobResult } from './job-types';

/** Retries wait a little longer each time: 2, 4, 8 ... minutes, capped at two hours. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 * 60_000 * 2 ** Math.max(0, attempts - 1), 2 * 3_600_000);
}

export function createJob(id: string, params: JobParams, now: Date, maxAttempts: number): Job {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts must be a positive integer');
  const at = now.toISOString();
  return { id, params, status: 'pending', attempts: 0, maxAttempts, createdAt: at, updatedAt: at };
}

/** A sortable, readable id: `<kind>-<yyyymmddHHMMSS>-<suffix>`. */
export function jobId(kind: JobParams['kind'], now: Date, suffix: string): string {
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${kind}-${stamp}-${suffix}`;
}

/** The pending job to run now: earliest kind in pipeline order, then the oldest; retries wait for `notBefore`. */
export function nextRunnable(jobs: readonly Job[], now: Date): Job | undefined {
  const ready = jobs.filter((job) => job.status === 'pending' && job.attempts < job.maxAttempts && (!job.notBefore || Date.parse(job.notBefore) <= now.getTime()));
  ready.sort((a, b) => JOB_KINDS.indexOf(a.params.kind) - JOB_KINDS.indexOf(b.params.kind) || a.createdAt.localeCompare(b.createdAt));
  return ready[0];
}

/** Earliest `notBefore` among pending jobs that are waiting for a retry, so an idle runner knows when to look again. */
export function nextRetryAt(jobs: readonly Job[]): Date | undefined {
  const times = jobs.filter((job) => job.status === 'pending' && job.notBefore).map((job) => Date.parse(job.notBefore ?? ''));
  return times.length > 0 ? new Date(Math.min(...times)) : undefined;
}

export function markRunning(job: Job, now: Date): Job {
  if (job.status !== 'pending') throw new Error(`job ${job.id} is ${job.status}, not pending`);
  if (job.attempts >= job.maxAttempts) throw new Error(`job ${job.id} has used all ${job.maxAttempts} attempts`);
  const at = now.toISOString();
  return { ...job, status: 'running', attempts: job.attempts + 1, startedAt: at, updatedAt: at, notBefore: undefined, finishedAt: undefined };
}

/** A finished attempt: `passed` when at least one item passed QC, `rejected` when nothing usable came out. */
export function markFinished(job: Job, now: Date, result: JobResult, status: 'passed' | 'rejected'): Job {
  const at = now.toISOString();
  return { ...job, status, result, finishedAt: at, updatedAt: at, lastError: undefined };
}

/** A failed attempt goes back to pending after a delay until the retry cap, then stays failed. */
export function markFailed(job: Job, now: Date, error: string): Job {
  const at = now.toISOString();
  const lastError = error.slice(0, 2000);
  if (job.attempts >= job.maxAttempts) return { ...job, status: 'failed', lastError, finishedAt: at, updatedAt: at };
  return { ...job, status: 'pending', lastError, updatedAt: at, notBefore: new Date(now.getTime() + retryDelayMs(job.attempts)).toISOString() };
}

/** Stopped by the operator (SIGINT): back to pending, and the attempt is not counted. */
export function markInterrupted(job: Job, now: Date): Job {
  return { ...job, status: 'pending', attempts: Math.max(0, job.attempts - 1), startedAt: undefined, updatedAt: now.toISOString() };
}

/**
 * Jobs left `running` by a runner that died (power cut, crash). The lock guarantees no other runner is alive, so
 * they count as failed attempts: a job that crashes the runner every time cannot loop forever.
 */
export function recoverStale(jobs: readonly Job[], now: Date): Job[] {
  return jobs.filter((job) => job.status === 'running').map((job) => markFailed(job, now, 'interrupted: the runner stopped while this job was running'));
}

/** Reset a failed or rejected job for another round of attempts (operator action). */
export function requeue(job: Job, now: Date): Job {
  if (job.status === 'running') throw new Error(`job ${job.id} is running`);
  return { ...job, status: 'pending', attempts: 0, notBefore: undefined, lastError: undefined, updatedAt: now.toISOString() };
}
