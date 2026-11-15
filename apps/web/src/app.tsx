import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { AccountProvider } from './account/account-context';
import { GameSessionProvider } from './game/game-session-context';
import { QuietHourProvider } from './quiet-hour/quiet-hour-provider';
import { SyncProvider } from './sync/sync-provider';

// Babylon.js and the whole game load in their own chunk.
const Game3dShell = lazy(() => import('./engine/game-3d-shell').then((m) => ({ default: m.Game3dShell })));

/**
 * The account is optional: the providers render their children at once and talk to the server in the background, so
 * a guest (or a page with no server behind it) plays exactly as before.
 */
export function App(): ReactNode {
  return (
    <AccountProvider>
      <GameSessionProvider>
        <SyncProvider>
          <QuietHourProvider>
            <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
              <Game3dShell />
            </Suspense>
          </QuietHourProvider>
        </SyncProvider>
      </GameSessionProvider>
    </AccountProvider>
  );
}
