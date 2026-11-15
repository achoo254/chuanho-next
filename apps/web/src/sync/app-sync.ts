/**
 * The app's sync engine with its two collections (progress and the journal) and the links back into React: the
 * provider calls `link()` on every change of the session's progress and callbacks, and the engine reads them when a
 * sync runs. Kept outside React so the engine lives once per page, not per render.
 */
import type { AccountApi } from '../account/account-api';
import type { JournalStore } from '../features/journal/journal-store';
import { DEFAULT_PROGRESS, type PlayerProgress } from '../game/player-progress';
import { createJournalCollection } from './journal-collection';
import { createProgressCollection } from './progress-collection';
import { adoptServerProgress } from './progress-doc';
import { type SyncClock, type SyncEngine, createSyncEngine } from './sync-engine';
import type { SyncBookmarkStorage } from './sync-state-storage';

export interface AppSyncLinks {
  readonly progress: PlayerProgress;
  /** The session's way to take progress merged by sync (no new preference stamp). */
  adoptProgress(change: (current: PlayerProgress) => PlayerProgress): void;
  /** The account learned the session is gone. */
  markSignedOut(): void;
}

export interface AppSync {
  readonly engine: SyncEngine;
  link(links: AppSyncLinks): void;
  /**
   * After the server's data was deleted: wipes the synced data on this device too (progress and journal) and syncs on
   * from a clean start, so nothing older than now is uploaded again.
   */
  wipeLocalAndRestart(): void;
}

export interface AppSyncDeps {
  readonly api: Pick<AccountApi, 'sync'>;
  readonly journal: JournalStore;
  readonly storage: SyncBookmarkStorage;
  readonly clock: SyncClock;
}

export function createAppSync({ api, journal, storage, clock }: AppSyncDeps): AppSync {
  let links: AppSyncLinks = { progress: DEFAULT_PROGRESS, adoptProgress: () => undefined, markSignedOut: () => undefined };

  const engine = createSyncEngine({
    collections: [
      createProgressCollection({
        read: () => links.progress,
        adopt: (server) => links.adoptProgress((current) => adoptServerProgress(current, server)),
      }),
      createJournalCollection(journal),
    ],
    send: (request) => api.sync(request),
    storage,
    clock,
    onUnauthorized: () => links.markSignedOut(),
  });

  return {
    engine,
    link(next) {
      links = next;
    },
    wipeLocalAndRestart() {
      // The link first: the engine's next request must already see the wiped progress, not wait for a render.
      links = { ...links, progress: DEFAULT_PROGRESS };
      links.adoptProgress(() => DEFAULT_PROGRESS);
      journal.removeAll();
      engine.restartFromNow();
    },
  };
}
