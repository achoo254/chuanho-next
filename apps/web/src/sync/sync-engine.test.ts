import { EMPTY_PROGRESS, type SyncRequest } from '@chuanho/contract';
import { describe, expect, it } from 'vitest';
import { SYNC_AFTER_CHANGE_MS, SYNC_EVERY_MS } from './sync-engine';
import { type Reply, START, entry, ok, settle, setupSync as setup } from './sync-engine-harness';

describe('sync engine: first sync and bookmark', () => {
  it('uploads everything on the device on the first sync of an account and saves the bookmark', async () => {
    const t = setup({ entries: [entry('aaaaaaaa-1', 100, 'a'), entry('bbbbbbbb-2', 200)], replies: [ok({ cursor: 7, progress: { ...EMPTY_PROGRESS, merit: 50 } })] });
    t.engine.start('user-1');
    await settle();
    expect(t.requests[0]).toMatchObject({ cursor: 0, progress: { merit: 30 } });
    expect(t.requests[0]?.journal.map((e) => e.id)).toEqual(['aaaaaaaa-1', 'bbbbbbbb-2']);
    expect(t.storage.value).toEqual({ accountId: 'user-1', cursor: 7, lastSyncedAt: START, epoch: 1 });
    expect(t.getProgress().merit).toBe(50);
    expect(t.engine.getStatus()).toEqual({ state: 'idle', lastSyncedAt: START, full: [] });
  });

  it('continues from the stored bookmark of the same account', async () => {
    const t = setup({ entries: [entry('aaaaaaaa-1', START - 500), entry('bbbbbbbb-2', START - 50)], stored: { accountId: 'user-1', cursor: 9, lastSyncedAt: START - 100, epoch: 1 } });
    t.engine.start('user-1');
    await settle();
    expect(t.requests[0]?.cursor).toBe(9);
    expect(t.requests[0]?.journal.map((e) => e.id)).toEqual(['bbbbbbbb-2']);
  });

  it("drops another account's bookmark and starts over", async () => {
    const t = setup({ entries: [entry('aaaaaaaa-1', START - 500)], stored: { accountId: 'user-0', cursor: 9, lastSyncedAt: START - 100, epoch: 1 } });
    t.engine.start('user-1');
    await settle();
    expect(t.requests[0]?.cursor).toBe(0);
    expect(t.requests[0]?.journal).toHaveLength(1);
    expect(t.storage.value?.accountId).toBe('user-1');
  });

  it('merges journal entries from the server', async () => {
    const t = setup({ replies: [ok({ cursor: 3, journal: [entry('cccccccc-3', START - 10, 'from the other phone')] })] });
    t.engine.start('user-1');
    await settle();
    expect(t.journal.getEntries().map((e) => e.id)).toEqual(['cccccccc-3']);
  });
});

describe('sync engine: when it syncs', () => {
  it('syncs a few seconds after a local change, and every minute', async () => {
    const t = setup();
    t.engine.start('user-1');
    await settle();
    expect(t.clock.delays()).toEqual([SYNC_EVERY_MS]);
    await t.clock.advance(1_000);
    t.journal.add({ kind: 'lie', note: '' });
    t.engine.localChange();
    expect(t.clock.delays()).toEqual([SYNC_AFTER_CHANGE_MS]);
    await t.clock.advance(SYNC_AFTER_CHANGE_MS);
    expect(t.requests).toHaveLength(2);
    expect(t.requests[1]?.journal).toHaveLength(1);
    await t.clock.advance(SYNC_EVERY_MS);
    expect(t.requests).toHaveLength(3);
    expect(t.requests[2]?.journal).toHaveLength(0);
  });

  it('does not sync for a change with nothing new (such as merging the server answer)', async () => {
    const t = setup({ replies: [ok({ journal: [entry('cccccccc-3', START + 60_000)] })] });
    t.engine.start('user-1');
    await settle();
    t.engine.localChange();
    expect(t.clock.delays()).toEqual([SYNC_EVERY_MS]);
    // An entry stamped ahead of this device's clock is not sent back on the next sync either.
    await t.clock.advance(SYNC_EVERY_MS);
    expect(t.requests[1]?.journal).toEqual([]);
  });

  it('syncs again after a request when something changed while it was out', async () => {
    const t = setup();
    let release: (reply: Reply) => void = () => undefined;
    t.send.mockImplementationOnce(async (request: SyncRequest) => {
      t.requests.push(request);
      return new Promise<Reply>((resolve) => (release = resolve));
    });
    t.engine.start('user-1');
    await t.clock.advance(10);
    t.journal.add({ kind: 'anger', note: '' });
    t.engine.localChange();
    release(ok());
    await settle();
    expect(t.clock.delays()).toEqual([SYNC_AFTER_CHANGE_MS]);
    await t.clock.advance(SYNC_AFTER_CHANGE_MS);
    expect(t.requests[1]?.journal).toHaveLength(1);
  });

  it('syncs when the tab comes back into view, but not twice in a row', async () => {
    const t = setup();
    t.engine.start('user-1');
    await settle();
    t.engine.regainVisibility();
    await settle();
    expect(t.requests).toHaveLength(1);
    await t.clock.advance(20_000);
    t.engine.regainVisibility();
    await settle();
    expect(t.requests).toHaveLength(2);
  });
});
