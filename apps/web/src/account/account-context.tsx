/**
 * The account behind `useAccount()`: asks GET /api/me once on load and again when the tab regains focus (at most
 * every 15 s), signs out with POST /auth/logout. Signing in is a plain link (see account-api `signInHref`), so this
 * holds no sign-in state of its own. Nothing here blocks the game: the provider renders its children at once.
 */
import type { MeResponse } from '@chuanho/contract';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type AccountApi, accountApi } from './account-api';
import { type AccountState, type AccountStatus, GUEST, LOADING, nextAccountState, shouldRecheck } from './account-state';

interface Account {
  readonly status: AccountStatus;
  /** The signed-in account, null otherwise. */
  readonly user: MeResponse | null;
  /** Ends the session; answers false when the server could not be reached (still signed in). */
  signOut(): Promise<boolean>;
  /** Another call learned that the session is gone (401). */
  markSignedOut(): void;
  readonly api: AccountApi;
}

const AccountContext = createContext<Account | null>(null);

export function AccountProvider({ children, api = accountApi }: { children: ReactNode; api?: AccountApi }): ReactNode {
  const [state, setState] = useState<AccountState>(LOADING);
  const lastCheckAt = useRef(0);
  // Bumped on sign-out, so a /api/me answer that left before it cannot sign the player back in.
  const epoch = useRef(0);

  const check = useCallback(async (): Promise<void> => {
    lastCheckAt.current = Date.now();
    const mine = epoch.current;
    const result = await api.me();
    if (mine === epoch.current) setState((previous) => nextAccountState(previous, result));
  }, [api]);

  useEffect(() => {
    void check();
    const recheck = (): void => {
      if (document.visibilityState === 'visible' && shouldRecheck(lastCheckAt.current, Date.now())) void check();
    };
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    return () => {
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [check]);

  const markSignedOut = useCallback((): void => {
    epoch.current += 1;
    setState(GUEST);
  }, []);

  const signOut = useCallback(async (): Promise<boolean> => {
    const result = await api.signOut();
    // 401: the session had already ended, which is what was asked for.
    const done = result.ok || result.error.kind === 'unauthorized';
    if (done) markSignedOut();
    return done;
  }, [api, markSignedOut]);

  const value = useMemo<Account>(
    () => ({ status: state.status, user: state.status === 'signedIn' ? state.user : null, signOut, markSignedOut, api }),
    [state, signOut, markSignedOut, api],
  );
  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): Account {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount outside AccountProvider');
  return value;
}
