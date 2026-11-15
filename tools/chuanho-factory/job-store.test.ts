import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createJob, markRunning } from './job-queue';
import { JobStore, parseState, serializeLine } from './job-store';
import { acquireRunnerLock } from './runner-lock';

const t0 = new Date('2026-11-15T16:00:00Z');
const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'chuanho-factory-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('queue state file', () => {
  it('keeps the last line of each job, removals, and skips torn or foreign lines', () => {
    const job = createJob('a', { kind: 'music', count: 2 }, t0, 3);
    const text = [
      serializeLine({ type: 'job', job }),
      serializeLine({ type: 'job', job: createJob('b', { kind: 'beatmap' }, t0, 3) }),
      serializeLine({ type: 'job', job: markRunning(job, t0) }),
      serializeLine({ type: 'removal', removal: { trackId: 'm012', reason: 'harsh', at: t0.toISOString() } }),
      '{"type":"job","job":{"id":"c","status":"weird"}}\n',
      '{"type":"job","job":{"id":"d","sta', // torn last write
    ].join('');
    const state = parseState(text);
    expect(state.jobs.map((j) => [j.id, j.status])).toEqual([
      ['b', 'pending'],
      ['a', 'running'],
    ]);
    expect(state.removals).toEqual([{ trackId: 'm012', reason: 'harsh', at: t0.toISOString() }]);
    expect(state.skippedLines).toBe(2);
  });

  it('rejects stored jobs with invalid params', () => {
    const bad = { ...createJob('x', { kind: 'music', count: 2 }, t0, 3), params: { kind: 'music', count: -1 } };
    expect(parseState(`${JSON.stringify({ type: 'job', job: bad })}\n`).jobs).toEqual([]);
  });

  it('appends, reloads and compacts superseded lines', async () => {
    const dir = await tempDir();
    const store = new JobStore(dir);
    expect((await store.load()).jobs).toEqual([]);
    let job = createJob('a', { kind: 'beatmap' }, t0, 3);
    for (let i = 0; i < 250; i += 1) {
      job = { ...job, updatedAt: new Date(t0.getTime() + i).toISOString() };
      await store.saveJob(job);
    }
    const state = await store.load();
    expect(state.jobs).toHaveLength(1);
    expect(await store.compactIfNeeded(state)).toBe(true);
    const lines = (await readFile(store.path, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(1);
    expect((await store.load()).jobs[0]?.updatedAt).toBe(job.updatedAt);
  });
});

describe('runner lock', () => {
  it('lets one runner in, refuses a second while the first is alive, takes over a dead one', async () => {
    const dir = await tempDir();
    const first = await acquireRunnerLock(dir, 1111, () => true);
    await expect(acquireRunnerLock(dir, 2222, () => true)).rejects.toThrow(/pid 1111/);
    const second = await acquireRunnerLock(dir, 2222, (pid) => pid !== 1111);
    expect((await readFile(path.join(dir, 'runner.lock'), 'utf8')).trim()).toBe('2222');
    await first.release(); // no longer the owner: must not delete the new lock
    expect((await readFile(path.join(dir, 'runner.lock'), 'utf8')).trim()).toBe('2222');
    await second.release();
    const third = await acquireRunnerLock(dir, 3333, () => true);
    await third.release();
  });

  it('treats a garbage lock file as stale', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'runner.lock'), 'not a pid', 'utf8');
    const lock = await acquireRunnerLock(dir, 4444, () => true);
    await lock.release();
  });
});
