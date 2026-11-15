import { EMPTY_PROGRESS, type JournalEntry, type SyncRequest, mergeProgress } from '@chuanho/contract';
import { describe, expect, it, vi } from 'vitest';
import { createJournalStore } from '../features/journal/journal-store';
import { DEFAULT_PROGRESS, type PlayerProgress } from '../game/player-progress';
import { createAppSync } from './app-sync';

const NOW = 1_800_000_000_000;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  let saved: readonly JournalEntry[] = [];
  const journal = createJournalStore({ load: () => saved, save: (list) => void (saved = list) }, { now: () => NOW - 10, today: () => '2027-01-15', newId: () => 'entry-0001' });
  const requests: SyncRequest[] = [];
  const api = {
    sync: vi.fn(async (request: SyncRequest) => {
      requests.push(request);
      return { ok: true as const, value: { progress: mergeProgress(EMPTY_PROGRESS, request.progress), journal: [], cursor: 1 } };
    }),
  };
  let bookmark: { accountId: string; cursor: number; lastSyncedAt: number } | null = null;
  const sync = createAppSync({
    api,
    journal,
    storage: { load: () => bookmark, save: (b) => void (bookmark = b), clear: () => void (bookmark = null) },
    clock: { now: () => NOW, later: () => () => undefined },
  });
  let progress: PlayerProgress = { ...DEFAULT_PROGRESS, merit: 70 };
  const adoptProgress = vi.fn((change: (current: PlayerProgress) => PlayerProgress) => {
    progress = change(progress);
  });
  const markSignedOut = vi.fn();
  sync.link({ progress, adoptProgress, markSignedOut });
  return { sync, journal, requests, adoptProgress, getProgress: () => progress };
}

describe('app sync', () => {
  it('sends the linked progress and the journal on the first sync', async () => {
    const t = setup();
    t.journal.add({ kind: 'gossip', note: 'note' });
    t.sync.engine.start('user-1');
    await settle();
    expect(t.requests[0]?.progress.merit).toBe(70);
    expect(t.requests[0]?.journal).toHaveLength(1);
  });

  it('wipes progress and journal on this device and uploads neither again', async () => {
    const t = setup();
    t.journal.add({ kind: 'gossip', note: 'note' });
    t.sync.engine.start('user-1');
    await settle();
    t.sync.wipeLocalAndRestart();
    await settle();
    expect(t.getProgress()).toEqual(DEFAULT_PROGRESS);
    expect(t.journal.getEntries().every((entry) => entry.deletedAt !== null)).toBe(true);
    const last = t.requests.at(-1);
    expect(last?.progress.merit).toBe(0);
    expect(last?.journal).toEqual([]);
  });
});
