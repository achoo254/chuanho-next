import { describe, expect, it } from 'vitest';
import { createJob, jobId, markFailed, markFinished, markInterrupted, markRunning, nextRetryAt, nextRunnable, recoverStale, requeue, retryDelayMs } from './job-queue';
import { parseJobParams } from './job-params';
import type { JobResult } from './job-types';

const t0 = new Date('2026-11-15T16:00:00Z');
const later = (ms: number): Date => new Date(t0.getTime() + ms);
const result: JobResult = { outputs: [], qc: [], summary: {} };

describe('job queue transitions', () => {
  it('picks pending jobs in pipeline order, then oldest first', () => {
    const video = createJob('v', { kind: 'video', seconds: 30, withVoice: true }, t0, 3);
    const musicOld = createJob('m1', { kind: 'music', count: 2 }, later(1), 3);
    const musicNew = createJob('m2', { kind: 'music', count: 2 }, later(2), 3);
    const done = { ...createJob('m0', { kind: 'music', count: 1 }, t0, 3), status: 'passed' as const };
    expect(nextRunnable([video, musicNew, musicOld, done], later(5))?.id).toBe('m1');
    expect(nextRunnable([video], later(5))?.id).toBe('v');
    expect(nextRunnable([done], later(5))).toBeUndefined();
  });

  it('counts attempts and retries with a growing delay until the cap', () => {
    let job = createJob('s', { kind: 'scene', times: ['night'] }, t0, 2);
    job = markRunning(job, t0);
    expect(job).toMatchObject({ status: 'running', attempts: 1 });
    job = markFailed(job, later(1000), 'ComfyUI unreachable');
    expect(job.status).toBe('pending');
    expect(Date.parse(job.notBefore ?? '')).toBe(later(1000).getTime() + retryDelayMs(1));
    expect(nextRunnable([job], later(2000))).toBeUndefined();
    expect(nextRetryAt([job])?.toISOString()).toBe(job.notBefore);
    expect(nextRunnable([job], later(1000 + retryDelayMs(1)))?.id).toBe('s');
    job = markFailed(markRunning(job, later(10 * 60_000)), later(11 * 60_000), 'again');
    expect(job).toMatchObject({ status: 'failed', attempts: 2, lastError: 'again' });
    expect(() => markRunning({ ...job, status: 'pending' }, later(1))).toThrow(/all 2 attempts/);
    expect(nextRunnable([{ ...job, status: 'pending', notBefore: undefined }], later(1))).toBeUndefined();
  });

  it('retry delays grow and are capped at two hours', () => {
    expect(retryDelayMs(1)).toBe(2 * 60_000);
    expect(retryDelayMs(2)).toBe(4 * 60_000);
    expect(retryDelayMs(20)).toBe(2 * 3_600_000);
  });

  it('an interrupted attempt is not counted; a stale running job is', () => {
    const running = markRunning(createJob('b', { kind: 'beatmap' }, t0, 3), t0);
    expect(markInterrupted(running, later(1))).toMatchObject({ status: 'pending', attempts: 0 });
    const [recovered] = recoverStale([running, createJob('x', { kind: 'beatmap' }, t0, 3)], later(1));
    expect(recovered).toMatchObject({ id: 'b', status: 'pending', attempts: 1 });
    expect(recovered?.lastError).toMatch(/interrupted/);
  });

  it('finishes with a status and a result; requeue resets attempts', () => {
    const finished = markFinished(markRunning(createJob('p', { kind: 'publish-library' }, t0, 3), t0), later(5), result, 'rejected');
    expect(finished).toMatchObject({ status: 'rejected', finishedAt: later(5).toISOString() });
    expect(requeue(finished, later(6))).toMatchObject({ status: 'pending', attempts: 0 });
    expect(() => requeue(markRunning(createJob('r', { kind: 'beatmap' }, t0, 1), t0), t0)).toThrow(/running/);
  });

  it('builds sortable ids and refuses a bad retry cap', () => {
    expect(jobId('music', t0, 'ab12')).toBe('music-20261115160000-ab12');
    expect(() => createJob('z', { kind: 'beatmap' }, t0, 0)).toThrow();
  });
});

describe('job params', () => {
  it('accepts valid params and explains bad ones', () => {
    expect(parseJobParams({ kind: 'music', count: 8 })).toEqual({ params: { kind: 'music', count: 8 } });
    expect(parseJobParams({ kind: 'scene', times: ['night', 'night', 'noon'] })).toEqual({ params: { kind: 'scene', times: ['night', 'noon'] } });
    expect(parseJobParams({ kind: 'video', seconds: 30, withVoice: false, time: 'evening' })).toEqual({ params: { kind: 'video', seconds: 30, withVoice: false, time: 'evening' } });
    expect(parseJobParams({ kind: 'music', count: 500 })).toHaveProperty('error');
    expect(parseJobParams({ kind: 'scene', times: ['dawn'] })).toHaveProperty('error');
    expect(parseJobParams({ kind: 'video', seconds: 90, withVoice: true })).toHaveProperty('error');
    expect(parseJobParams({ kind: 'video', seconds: 30, withVoice: true, time: 'dusk' })).toHaveProperty('error');
    expect(parseJobParams({ kind: 'verse-voice', verseIds: ['../x'] })).toHaveProperty('error');
    expect(parseJobParams({ kind: 'deploy' })).toHaveProperty('error');
    expect(parseJobParams(null)).toHaveProperty('error');
  });
});
