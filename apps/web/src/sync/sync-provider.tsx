/**
 * Wires account sync into the app: one engine for the page (app-sync.ts), started while an account is signed in, fed
 * by the session's progress and the journal store, and stopped (its bookmark forgotten) when the player becomes a
 * guest. `useSyncStatus()` reads it for the account menu. Local-first: nothing here delays a render or a tap.
 */
import { type ReactNode, createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useAccount } from '../account/account-context';
import { journalStore } from '../features/journal/journal-store';
import { useGameSession } from '../game/game-session-context';
import { type AppSync, createAppSync } from './app-sync';
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
    if (accountId) engine.start(accountId);
    // A guest (signed out, or the session ended) leaves no bookmark behind; an unreachable server keeps it.
    else if (status === 'guest') engine.stop({ forget: true });
    else if (status === 'error') engine.stop();
  }, [engine, accountId, status]);

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

export interface SyncControls {
  /** See AppSync.wipeLocalAndRestart. */
  wipeLocalAndRestart(): void;
}

export function useSyncControls(): SyncControls {
  return useAppSync();
}
