/**
 * Wires account sync into the app: one engine for the page (app-sync.ts), started while an account is signed in and
 * the device's data is that account's, fed by the session's progress and the journal store, and stopped when the
 * player becomes a guest (the data keeps its owner mark). When the data on the device is a guest's or another
 * account's, sync waits for the player's answer (`useOwnershipQuestion()`, shown by the account UI).
 * `useSyncStatus()` reads the engine for the account menu. Local-first: nothing here delays a render or a tap.
 */
import { type ReactNode, createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useAccount } from '../account/account-context';
import { journalStore } from '../features/journal/journal-store';
import { useGameSession } from '../game/game-session-context';
import { type AppSync, createAppSync } from './app-sync';
import type { OwnershipChoice, OwnershipQuestion } from './ownership-decision';
import type { SyncStatus } from './sync-engine';
import { localSyncBookmarkStorage } from './sync-state-storage';

const SyncContext = createContext<AppSync | null>(null);

const browserClock = {
  now: (): number => Date.now(),
  later(run: () => void, ms: number): () => void {
    const timer = window.setTimeout(run, ms);
    return () => window.clearTimeout(timer);
  },
};

export function SyncProvider({ children }: { children: ReactNode }): ReactNode {
  const { status, user, api, markSignedOut } = useAccount();
  const { progress, adoptProgress } = useGameSession();
  const [sync] = useState(() => createAppSync({ api, journal: journalStore, storage: localSyncBookmarkStorage, clock: browserClock }));
  const { engine } = sync;

  // Declared first, so the engine already sees the current progress when the start below runs.
  useEffect(() => {
    sync.link({ progress, adoptProgress, markSignedOut });
    engine.localChange();
  }, [sync, engine, progress, adoptProgress, markSignedOut]);

  const accountId = user?.id ?? null;
  useEffect(() => {
    if (accountId) sync.signIn(accountId);
    // Signed out, the session ended or the server is unreachable: the device's data stays and keeps its owner.
    else if (status === 'guest' || status === 'error') sync.pause();
  }, [sync, accountId, status]);

  useEffect(() => {
    const unsubscribe = journalStore.subscribe(() => engine.localChange());
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') engine.regainVisibility();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      engine.stop();
    };
  }, [engine]);

  return <SyncContext value={sync}>{children}</SyncContext>;
}

function useAppSync(): AppSync {
  const value = useContext(SyncContext);
  if (!value) throw new Error('sync used outside SyncProvider');
  return value;
}

export function useSyncStatus(): SyncStatus {
  const { engine } = useAppSync();
  return useSyncExternalStore(engine.subscribe, engine.getStatus, engine.getStatus);
}

export type SyncControls = Pick<AppSync, 'wipeLocalAndRestart' | 'wipeLocalAndForget' | 'releaseToGuest'>;

export function useSyncControls(): SyncControls {
  return useAppSync();
}

export interface OwnershipPrompt {
  /** The question waiting for the signed-in player, null when sync runs. */
  readonly question: OwnershipQuestion | null;
  answer(choice: OwnershipChoice): void;
}

export function useOwnershipQuestion(): OwnershipPrompt {
  const sync = useAppSync();
  const pending = useSyncExternalStore(sync.subscribePending, sync.getPending, sync.getPending);
  return { question: pending?.question ?? null, answer: sync.answer };
}
