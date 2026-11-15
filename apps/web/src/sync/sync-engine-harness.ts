/** Test harness of the sync engine: a manual clock, memory storage, a real journal store and a fake server that merges progress like the real one. */
import { EMPTY_PROGRESS, type JournalEntry, type ProgressDoc, type SyncRequest, type SyncResponse, mergeProgress } from '@chuanho/contract';
import { vi } from 'vitest';
import type { ApiResult } from '../account/account-api';
import { type JournalStore, createJournalStore } from '../features/journal/journal-store';
import { DEFAULT_PROGRESS, type PlayerProgress } from '../game/player-progress';
import { createJournalCollection } from './journal-collection';
import { createProgressCollection } from './progress-collection';
import { adoptServerProgress } from './progress-doc';
import { createSyncEngine } from './sync-engine';
import type { SyncBookmark, SyncBookmarkStorage } from './sync-state-storage';

export const START = 1_800_000_000_000;
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export function manualClock() {
  let now = START;
  let timers: { at: number; run: () => void }[] = [];
  return {
    now: () => now,
    later(run: () => void, ms: number): () => void {
      const timer = { at: now + ms, run };
      timers.push(timer);
      return () => {
        timers = timers.filter((t) => t !== timer);
      };
    },
    /** Moves time forward, firing due timers in order and letting their promises settle. */
    async advance(ms: number): Promise<void> {
      const target = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > target) break;
        timers.shift();
        now = next.at;
        next.run();
        await settle();
      }
      now = target;
    },
    delays: () => timers.map((t) => t.at - now),
  };
}

function memoryStorage(initial: SyncBookmark | null = null): SyncBookmarkStorage & { value: SyncBookmark | null } {
  const box = {
    value: initial,
    load: () => box.value,
    save: (bookmark: SyncBookmark) => {
      box.value = bookmark;
    },
    clear: () => {
      box.value = null;
    },
  };
  return box;
}

export const entry = (id: string, updatedAt: number, note = ''): JournalEntry => ({
  id,
  day: '2027-01-15',
  kind: 'harsh',
  note,
  released: { reset: false, apology: false, deed: false },
  createdAt: updatedAt,
  updatedAt,
  deletedAt: null,
});

export type Reply = ApiResult<SyncResponse>;
export const ok = (value: Partial<SyncResponse> = {}): Reply => ({ ok: true, value: { progress: EMPTY_PROGRESS, journal: [], cursor: 0, ...value } });

export function setupSync(options: { entries?: JournalEntry[]; stored?: SyncBookmark | null; replies?: Reply[] } = {}) {
  const clock = manualClock();
  const storage = memoryStorage(options.stored ?? null);
  let saved: readonly JournalEntry[] = options.entries ?? [];
  const journal: JournalStore = createJournalStore(
    { load: () => saved, save: (list) => void (saved = list) },
    { now: clock.now, today: () => '2027-01-15', newId: () => `entry-${clock.now()}` },
  );
  let progress: PlayerProgress = { ...DEFAULT_PROGRESS, merit: 30 };
  const progressSource = {
    read: () => progress,
    adopt: (server: ProgressDoc) => {
      progress = adoptServerProgress(progress, server);
    },
  };
  const replies = [...(options.replies ?? [])];
  const requests: SyncRequest[] = [];
  const send = vi.fn(async (request: SyncRequest): Promise<Reply> => {
    requests.push(request);
    const reply = replies.shift() ?? ok({ cursor: request.cursor });
    // Like the server: the answer's progress is the stored one merged with what the device sent.
    return reply.ok ? { ok: true, value: { ...reply.value, progress: mergeProgress(reply.value.progress, request.progress) } } : reply;
  });
  const onUnauthorized = vi.fn();
  const engine = createSyncEngine({
    collections: [createProgressCollection(progressSource), createJournalCollection(journal)],
    send,
    storage,
    clock,
    onUnauthorized,
  });
  return { engine, clock, storage, journal, requests, send, onUnauthorized, getProgress: () => progress, setProgress: (p: PlayerProgress) => void (progress = p) };
}
