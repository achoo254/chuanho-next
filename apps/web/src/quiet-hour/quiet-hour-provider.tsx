/**
 * "Giờ Tĩnh" for the page: polls the public status (every 30 s while it is on, every 5 minutes otherwise, never while
 * the tab is hidden) into the page's quiet-hour session, which also owns the one stroke batcher. `useQuietHour()`
 * feeds the HUD chip; `useQuietHourStrokes()` gives a mode a function to count the player's strokes. With no server
 * reachable the status stays null and the chip stays hidden: the game does not change.
 */
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAccount } from '../account/account-context';
import { nextPollDelay } from './quiet-hour-clock';
import { createQuietHourPoller } from './quiet-hour-poller';
import { type QuietHourSession, type QuietHourSnapshot, createQuietHourSession } from './quiet-hour-session';

const QuietHourContext = createContext<{ readonly session: QuietHourSession; readonly signedIn: boolean } | null>(null);

const laterOnWindow = (run: () => void, ms: number): (() => void) => {
  const timer = window.setTimeout(run, ms);
  return () => window.clearTimeout(timer);
};

export function QuietHourProvider({ children }: { children: ReactNode }): ReactNode {
  const { api, status: accountStatus } = useAccount();
  const signedIn = accountStatus === 'signedIn';
  const [session] = useState(() => createQuietHourSession(api, laterOnWindow));

  useEffect(() => {
    session.setSignedIn(signedIn);
  }, [session, signedIn]);

  useEffect(() => {
    const poller = createQuietHourPoller({
      check: async () => {
        const result = await api.quietHourStatus();
        if (result.ok) session.take(result.value, Date.now());
      },
      isVisible: () => document.visibilityState === 'visible',
      nextDelay: () => nextPollDelay(session.serverNow()),
      later: laterOnWindow,
    });
    const onVisible = (): void => poller.wake();
    poller.start();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      poller.stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [api, session]);

  const value = useMemo(() => ({ session, signedIn }), [session, signedIn]);
  return <QuietHourContext value={value}>{children}</QuietHourContext>;
}

function useQuietHourContext(): { readonly session: QuietHourSession; readonly signedIn: boolean } {
  const value = useContext(QuietHourContext);
  if (!value) throw new Error('quiet hour used outside QuietHourProvider');
  return value;
}

/** The last status, the server clock offset and whether the player's strokes can count. */
export function useQuietHour(): QuietHourSnapshot & { readonly signedIn: boolean } {
  const { session, signedIn } = useQuietHourContext();
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return { ...snapshot, signedIn };
}

/** A function counting one stroke of the player; what is waiting is sent when the calling mode closes. */
export function useQuietHourStrokes(): () => void {
  const { batcher } = useQuietHourContext().session;
  useEffect(() => () => void batcher.flush(), [batcher]);
  return useCallback(() => batcher.add(), [batcher]);
}
