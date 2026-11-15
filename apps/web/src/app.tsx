import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { GameSessionProvider } from './game/game-session-context';

// Babylon.js and the whole game load in their own chunk.
const Game3dShell = lazy(() => import('./engine/game-3d-shell').then((m) => ({ default: m.Game3dShell })));

export function App(): ReactNode {
  return (
    <GameSessionProvider>
      <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
        <Game3dShell />
      </Suspense>
    </GameSessionProvider>
  );
}
