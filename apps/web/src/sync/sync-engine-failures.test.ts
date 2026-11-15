import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS } from '../game/player-progress';
import { retryDelay } from './sync-engine';
import { type Reply, START, entry, ok, settle, setupSync as setup } from './sync-engine-harness';

describe('sync engine: failures', () => {
  it('retries offline with a growing pause and keeps local data', async () => {
    const offline: Reply = { ok: false, error: { kind: 'offline' } };
    const t = setup({ entries: [entry('aaaaaaaa-1', 100, 'kept')], replies: [offline, offline, ok({ cursor: 2 })] });
    t.engine.start('user-1');
    await settle();
    expect(t.engine.getStatus().state).toBe('offline');
    expect(t.clock.delays()).toEqual([retryDelay(1)]);
    // Changes while retrying do not cut the pause short.
    t.engine.localChange();
    expect(t.clock.delays()).toEqual([retryDelay(1)]);
    await t.clock.advance(retryDelay(1));
    expect(t.clock.delays()).toEqual([retryDelay(2)]);
    await t.clock.advance(retryDelay(2));
    expect(t.engine.getStatus().state).toBe('idle');
    expect(t.requests[2]?.journal.map((e) => e.note)).toEqual(['kept']);
    expect(t.journal.getEntries()).toHaveLength(1);
  });

  it('reports a server error as error and a throwing network as offline', async () => {
    const t = setup({ replies: [{ ok: false, error: { kind: 'server', status: 500 } }] });
    t.engine.start('user-1');
    await settle();
    expect(t.engine.getStatus().state).toBe('error');
    t.send.mockRejectedValueOnce(new Error('network'));
    await t.clock.advance(retryDelay(1));
    expect(t.engine.getStatus().state).toBe('offline');
  });

  it('hands a 401 to the account and keeps the bookmark as the owner mark of the data', async () => {
    const stored = { accountId: 'user-1', cursor: 4, lastSyncedAt: 5, epoch: 2 };
    const t = setup({ stored, replies: [{ ok: false, error: { kind: 'unauthorized' } }] });
    t.engine.start('user-1');
    await settle();
    expect(t.onUnauthorized).toHaveBeenCalledOnce();
    expect(t.storage.value).toEqual(stored);
    expect(t.engine.getStatus()).toEqual({ state: 'idle', lastSyncedAt: null, full: [] });
    expect(t.clock.delays()).toEqual([]);
  });

  it('stops sending the journal when the server says it is full, and still syncs progress', async () => {
    const full: Reply = { ok: false, error: { kind: 'conflict', code: 'journal-full' } };
    const t = setup({ entries: [entry('aaaaaaaa-1', 100)], replies: [full, ok({ cursor: 1 })] });
    t.engine.start('user-1');
    await settle();
    await settle();
    expect(t.requests).toHaveLength(2);
    expect(t.requests[1]?.journal).toEqual([]);
    expect(t.requests[1]?.progress.merit).toBe(30);
    expect(t.engine.getStatus()).toMatchObject({ state: 'idle', full: ['journal'] });
  });
});

describe('sync engine: stopping and starting over', () => {
  it('ignores an answer that arrives after stopping, and forgets the bookmark when asked', async () => {
    const t = setup({ stored: { accountId: 'user-1', cursor: 4, lastSyncedAt: 5, epoch: 1 } });
    let release: (reply: Reply) => void = () => undefined;
    t.send.mockImplementationOnce(() => new Promise<Reply>((resolve) => (release = resolve)));
    t.engine.start('user-1');
    t.engine.stop({ forget: true });
    release(ok({ cursor: 99, journal: [entry('cccccccc-3', 50)] }));
    await settle();
    expect(t.storage.value).toBeNull();
    expect(t.journal.getEntries()).toEqual([]);
    expect(t.clock.delays()).toEqual([]);
  });

  it('after a full wipe, uploads nothing older than the restart', async () => {
    const t = setup({ entries: [entry('aaaaaaaa-1', START - 1)] });
    t.engine.start('user-1');
    await settle();
    await t.clock.advance(1_000);
    t.journal.removeAll();
    t.setProgress(DEFAULT_PROGRESS);
    t.engine.restartFromNow();
    await settle();
    const last = t.requests.at(-1);
    expect(last?.cursor).toBe(0);
    expect(last?.journal).toEqual([]);
    expect(last?.progress.merit).toBe(0);
  });
});

describe('retryDelay', () => {
  it('doubles from 5 s up to 5 minutes', () => {
    expect([1, 2, 3, 10].map(retryDelay)).toEqual([5_000, 10_000, 20_000, 300_000]);
  });
});
