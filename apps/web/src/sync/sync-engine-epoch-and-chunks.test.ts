import { EMPTY_PROGRESS } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { JOURNAL_SYNC_CHUNK } from './journal-collection';
import { retryDelay } from './sync-engine';
import { type Reply, START, entry, ok, settle, setupSync as setup } from './sync-engine-harness';

const offline: Reply = { ok: false, error: { kind: 'offline' } };
const manyEntries = (count: number) => Array.from({ length: count }, (_, i) => entry(`entry-${String(i).padStart(5, '0')}`, 100 + i));

describe('sync engine: data epoch', () => {
  it('sends the stored epoch and keeps the one the server answers', async () => {
    const t = setup({ stored: { accountId: 'user-1', cursor: 3, lastSyncedAt: START - 10, epoch: 2 }, replies: [ok({ cursor: 4, epoch: 2 })] });
    t.engine.start('user-1');
    await settle();
    expect(t.requests[0]?.epoch).toBe(2);
    expect(t.storage.value).toMatchObject({ cursor: 4, epoch: 2, lastSyncedAt: START });
    expect(t.discardLocal).not.toHaveBeenCalled();
  });

  it('takes the first epoch of a device that never knew one without wiping anything', async () => {
    const t = setup({ entries: [entry('aaaaaaaa-1', 100)], replies: [ok({ cursor: 1, epoch: 5 })] });
    t.engine.start('user-1');
    await settle();
    expect(t.requests[0]?.epoch).toBe(0);
    expect(t.storage.value?.epoch).toBe(5);
    expect(t.discardLocal).not.toHaveBeenCalled();
    expect(t.journal.getEntries().filter((e) => e.deletedAt === null)).toHaveLength(1);
  });

  it('drops the local copy when the data was deleted elsewhere, adopts the server state and uploads nothing old', async () => {
    const fromServer = entry('cccccccc-3', START - 5, 'written after the wipe');
    const t = setup({
      entries: [entry('aaaaaaaa-1', START - 50, 'old')],
      stored: { accountId: 'user-1', cursor: 9, lastSyncedAt: START - 100, epoch: 1 },
      replies: [ok({ cursor: 2, epoch: 2, journal: [fromServer], progress: { ...EMPTY_PROGRESS, merit: 4 } })],
    });
    t.engine.start('user-1');
    await settle();
    expect(t.discardLocal).toHaveBeenCalledOnce();
    expect(t.journal.getEntries().filter((e) => e.deletedAt === null).map((e) => e.id)).toEqual(['cccccccc-3']);
    expect(t.storage.value).toEqual({ accountId: 'user-1', cursor: 2, lastSyncedAt: START + 1, epoch: 2 });
    await t.clock.advance(60_000);
    const next = t.requests.at(-1);
    expect(next?.epoch).toBe(2);
    expect(next?.journal).toEqual([]);
  });

  it('restarting from now sends epoch 0, so the server answers its new epoch', async () => {
    const t = setup({ stored: { accountId: 'user-1', cursor: 9, lastSyncedAt: START - 100, epoch: 3 } });
    t.engine.start('user-1');
    await settle();
    t.engine.restartFromNow();
    await settle();
    expect(t.requests.at(-1)?.epoch).toBe(0);
    expect(t.discardLocal).not.toHaveBeenCalled();
  });
});

describe('sync engine: owner mark and fresh starts', () => {
  it('saves the bookmark as soon as an account starts, before any answer', () => {
    const t = setup({ replies: [offline] });
    t.engine.start('user-1');
    expect(t.storage.value).toEqual({ accountId: 'user-1', cursor: 0, lastSyncedAt: 0, epoch: 0 });
  });

  it('starting from now uploads nothing older than the start', async () => {
    const t = setup({ entries: [entry('aaaaaaaa-1', START - 1)], stored: { accountId: 'user-0', cursor: 9, lastSyncedAt: 5, epoch: 4 } });
    t.engine.start('user-1', { fromNow: true });
    await settle();
    expect(t.requests[0]).toMatchObject({ cursor: 0, epoch: 0, journal: [] });
    expect(t.storage.value?.accountId).toBe('user-1');
  });

  it('leaves deletion marks out of the first sync of an account', async () => {
    const deleted = { ...entry('bbbbbbbb-2', 200), deletedAt: 200 };
    const t = setup({ entries: [entry('aaaaaaaa-1', 100), deleted] });
    t.engine.start('user-1');
    await settle();
    expect(t.requests[0]?.journal.map((e) => e.id)).toEqual(['aaaaaaaa-1']);
  });
});

describe('sync engine: a large journal goes in chunks', () => {
  it('sends every changed entry in chunks and only then moves lastSyncedAt', async () => {
    const total = JOURNAL_SYNC_CHUNK * 2 + 500;
    const t = setup({ entries: manyEntries(total), replies: [ok({ cursor: 1 }), offline] });
    t.engine.start('user-1');
    await settle();
    await settle();
    // The second chunk failed: the sync is not done, so nothing counts as synced yet.
    expect(t.requests.map((r) => r.journal.length)).toEqual([JOURNAL_SYNC_CHUNK, JOURNAL_SYNC_CHUNK]);
    expect(t.storage.value).toMatchObject({ cursor: 1, lastSyncedAt: 0 });
    expect(t.engine.getStatus().lastSyncedAt).toBeNull();
    await t.clock.advance(retryDelay(1));
    await settle();
    expect(t.requests.map((r) => r.journal.length)).toEqual([JOURNAL_SYNC_CHUNK, JOURNAL_SYNC_CHUNK, JOURNAL_SYNC_CHUNK, 500]);
    const sentIds = new Set(t.requests.slice(2).flatMap((r) => r.journal.map((e) => e.id)));
    expect(sentIds.size).toBe(total - JOURNAL_SYNC_CHUNK);
    expect(t.storage.value?.lastSyncedAt).toBe(START);
    expect(t.engine.getStatus()).toMatchObject({ state: 'idle', lastSyncedAt: START });
  });
});
