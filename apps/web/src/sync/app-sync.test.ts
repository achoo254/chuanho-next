import { EMPTY_PROGRESS, type JournalEntry, type SyncRequest, mergeProgress } from '@chuanho/contract';
import { describe, expect, it, vi } from 'vitest';
import { createJournalStore } from '../features/journal/journal-store';
import { DEFAULT_PROGRESS, type PlayerProgress } from '../game/player-progress';
import { createAppSync } from './app-sync';
import type { SyncBookmark } from './sync-state-storage';

const NOW = 1_800_000_000_000;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup(options: { stored?: SyncBookmark | null; merit?: number } = {}) {
  let saved: readonly JournalEntry[] = [];
  const journal = createJournalStore({ load: () => saved, save: (list) => void (saved = list) }, { now: () => NOW - 10, today: () => '2027-01-15', newId: () => 'entry-0001' });
  const requests: SyncRequest[] = [];
  const api = {
    sync: vi.fn(async (request: SyncRequest) => {
      requests.push(request);
      return { ok: true as const, value: { progress: mergeProgress(EMPTY_PROGRESS, request.progress), journal: [], cursor: 1, epoch: 1 } };
    }),
  };
  let bookmark: SyncBookmark | null = options.stored ?? null;
  const sync = createAppSync({
    api,
    journal,
    storage: { load: () => bookmark, save: (b) => void (bookmark = b), clear: () => void (bookmark = null) },
    clock: { now: () => NOW, later: () => () => undefined },
  });
  let progress: PlayerProgress = { ...DEFAULT_PROGRESS, merit: options.merit ?? 70 };
  const adoptProgress = vi.fn((change: (current: PlayerProgress) => PlayerProgress) => {
    progress = change(progress);
  });
  sync.link({ progress, adoptProgress, markSignedOut: vi.fn() });
  const live = (): JournalEntry[] => journal.getEntries().filter((entry) => entry.deletedAt === null);
  return { sync, journal, requests, live, getProgress: () => progress, getBookmark: () => bookmark };
}

const owned = (accountId: string): SyncBookmark => ({ accountId, cursor: 3, lastSyncedAt: NOW - 1_000, epoch: 1 });

describe('app sync: whose data is on the device', () => {
  it('lets the owner of the data just sync', async () => {
    const t = setup({ stored: owned('user-1') });
    t.sync.signIn('user-1');
    await settle();
    expect(t.sync.getPending()).toBeNull();
    expect(t.requests[0]).toMatchObject({ cursor: 3, epoch: 1 });
  });

  it("asks before uploading a guest's data, then uploads it all on merge", async () => {
    const t = setup();
    t.journal.add({ kind: 'gossip', note: 'note' });
    t.sync.signIn('user-1');
    await settle();
    expect(t.sync.getPending()).toEqual({ accountId: 'user-1', question: 'merge' });
    expect(t.requests).toHaveLength(0);
    t.sync.answer('merge');
    await settle();
    expect(t.sync.getPending()).toBeNull();
    expect(t.requests[0]?.journal).toHaveLength(1);
    expect(t.requests[0]?.progress.merit).toBe(70);
  });

  it("starts clean when the player declines to merge a guest's data", async () => {
    const t = setup();
    t.journal.add({ kind: 'gossip', note: 'private' });
    t.sync.signIn('user-1');
    t.sync.answer('startClean');
    await settle();
    expect(t.live()).toEqual([]);
    expect(t.journal.getEntries().every((entry) => entry.note === '')).toBe(true);
    expect(t.getProgress()).toEqual(DEFAULT_PROGRESS);
    expect(t.requests[0]).toMatchObject({ journal: [], progress: { merit: 0 } });
  });

  it("never uploads another account's data: merge is refused, only starting clean goes on", async () => {
    const t = setup({ stored: owned('user-0') });
    t.journal.add({ kind: 'gossip', note: 'theirs' });
    t.sync.signIn('user-1');
    expect(t.sync.getPending()).toEqual({ accountId: 'user-1', question: 'startClean' });
    t.sync.answer('merge');
    await settle();
    expect(t.requests).toHaveLength(0);
    expect(t.getBookmark()?.accountId).toBe('user-0');
    t.sync.answer('startClean');
    await settle();
    expect(t.live()).toEqual([]);
    expect(t.requests[0]?.journal).toEqual([]);
    expect(t.getBookmark()?.accountId).toBe('user-1');
  });

  it('starts clean without asking when the device holds nothing worth keeping', async () => {
    const t = setup({ stored: owned('user-0'), merit: 0 });
    t.sync.signIn('user-1');
    await settle();
    expect(t.sync.getPending()).toBeNull();
    expect(t.getBookmark()?.accountId).toBe('user-1');
  });

  it('keeps the owner mark on pause, and forgets it with the data on "clear this device"', async () => {
    const t = setup({ stored: owned('user-1') });
    t.journal.add({ kind: 'gossip', note: 'note' });
    t.sync.signIn('user-1');
    await settle();
    t.sync.pause();
    expect(t.getBookmark()?.accountId).toBe('user-1');
    t.sync.wipeLocalAndForget();
    expect(t.getBookmark()).toBeNull();
    expect(t.live()).toEqual([]);
    expect(t.getProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it('hands the data to a guest after "delete only on the server", so the next sign-in asks first', () => {
    const t = setup({ stored: owned('user-1') });
    t.sync.signIn('user-1');
    t.sync.releaseToGuest();
    expect(t.getBookmark()).toBeNull();
    t.sync.signIn('user-1');
    expect(t.sync.getPending()?.question).toBe('merge');
  });
});

describe('app sync: delete everywhere', () => {
  it('wipes progress and journal on this device and uploads neither again', async () => {
    const t = setup({ stored: owned('user-1') });
    t.journal.add({ kind: 'gossip', note: 'note' });
    t.sync.signIn('user-1');
    await settle();
    t.sync.wipeLocalAndRestart();
    await settle();
    expect(t.getProgress()).toEqual(DEFAULT_PROGRESS);
    expect(t.journal.getEntries().every((entry) => entry.deletedAt !== null)).toBe(true);
    expect(t.requests.at(-1)).toMatchObject({ journal: [], epoch: 0, progress: { merit: 0 } });
  });
});
