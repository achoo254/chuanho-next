/**
 * The app's sync engine with its two collections (progress and the journal) and the links back into React: the
 * provider calls `link()` on every change of the session's progress and callbacks, and the engine reads them when a
 * sync runs. Kept outside React so the engine lives once per page, not per render.
 *
 * It also guards whose data is on the device (ownership-decision.ts): an account signing in syncs only once the
 * device's data is its own, and every way of handing the data over or clearing it goes through here.
 */
import type { AccountApi } from '../account/account-api';
import type { JournalStore } from '../features/journal/journal-store';
import { DEFAULT_PROGRESS, type PlayerProgress } from '../game/player-progress';
import { createJournalCollection } from './journal-collection';
import { blankedDeletionMarks } from './local-data-wipe';
import { type OwnershipChoice, type OwnershipQuestion, decideOwnership, hasLocalData, mergeAllowed } from './ownership-decision';
import { createProgressCollection } from './progress-collection';
import { adoptServerProgress, toProgressDoc } from './progress-doc';
import { type SyncClock, type SyncEngine, createSyncEngine } from './sync-engine';
import type { SyncBookmarkStorage } from './sync-state-storage';

export interface AppSyncLinks {
  readonly progress: PlayerProgress;
  /** The session's way to take progress merged by sync (no new preference stamp). */
  adoptProgress(change: (current: PlayerProgress) => PlayerProgress): void;
  /** The account learned the session is gone. */
  markSignedOut(): void;
}

/** A question the signed-in player must answer before their account syncs. */
export interface PendingOwnership {
  readonly accountId: string;
  readonly question: OwnershipQuestion;
}

export interface AppSync {
  readonly engine: SyncEngine;
  link(links: AppSyncLinks): void;
  /** `accountId` is signed in: syncs at once, or holds sync until the player answers `getPending()`. */
  signIn(accountId: string): void;
  /** The question waiting for the player (same object until it changes), null when none. */
  getPending(): PendingOwnership | null;
  subscribePending(listener: () => void): () => void;
  /** The player's answer to the pending question; "merge" is ignored when the data belongs to another account. */
  answer(choice: OwnershipChoice): void;
  /** No account any more (signed out, session ended, server unreachable): stops; the data keeps its owner mark. */
  pause(): void;
  /** Signing out with "clear this device": wipes progress and journal here; the empty device is a guest's. */
  wipeLocalAndForget(): void;
  /** After "delete only on the server": the device keeps its data as a guest's, so it is never sent again unasked. */
  releaseToGuest(): void;
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
  let pending: PendingOwnership | null = null;
  const pendingListeners = new Set<() => void>();
  const setPending = (next: PendingOwnership | null): void => {
    if (next?.accountId === pending?.accountId && next?.question === pending?.question) return;
    pending = next;
    for (const listener of pendingListeners) listener();
  };

  const wipeLocal = (): void => {
    // The link first: the engine's next request must already see the wiped progress, not wait for a render.
    links = { ...links, progress: DEFAULT_PROGRESS };
    links.adoptProgress(() => DEFAULT_PROGRESS);
    journal.merge(blankedDeletionMarks(journal.getEntries(), clock.now()));
  };

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
    discardLocal: wipeLocal,
  });

  const startClean = (accountId: string): void => {
    wipeLocal();
    engine.start(accountId, { fromNow: true });
  };

  return {
    engine,
    link(next) {
      links = next;
    },
    signIn(accountId) {
      const decision = decideOwnership({
        owner: storage.load()?.accountId ?? null,
        accountId,
        hasLocalData: hasLocalData(journal.getEntries(), toProgressDoc(links.progress)),
      });
      if (decision.kind === 'ask') {
        engine.stop();
        setPending({ accountId, question: decision.question });
        return;
      }
      setPending(null);
      if (decision.kind === 'startClean') startClean(accountId);
      else engine.start(accountId);
    },
    getPending: () => pending,
    subscribePending(listener) {
      pendingListeners.add(listener);
      return () => {
        pendingListeners.delete(listener);
      };
    },
    answer(choice) {
      if (!pending) return;
      const { accountId } = pending;
      if (choice === 'startClean') startClean(accountId);
      // The guest's data becomes this account's and goes up whole on the first sync.
      else if (mergeAllowed(storage.load()?.accountId ?? null, accountId)) engine.start(accountId);
      else return;
      setPending(null);
    },
    pause() {
      setPending(null);
      engine.stop();
    },
    wipeLocalAndForget() {
      engine.stop({ forget: true });
      wipeLocal();
    },
    releaseToGuest: () => engine.stop({ forget: true }),
    wipeLocalAndRestart() {
      wipeLocal();
      engine.restartFromNow();
    },
  };
}
