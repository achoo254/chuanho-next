/**
 * Shared game state: the stored progress and the session being played now. A full session is incense, one finished
 * rhythm song and the chant read to the end, in any order; finishing it rewards merit only on the first full
 * session of the local day. Afterwards the steps reset so the player can go around again (for fun, no reward).
 */
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { type PlayerProgress, completeFullSession, loadProgress, saveProgress } from './player-progress';
import { localDateKey } from './session-day';

export const SESSION_STEPS = ['incense', 'beat', 'sutra'] as const;
export type SessionStep = (typeof SESSION_STEPS)[number];
type StepsDone = Readonly<Record<SessionStep, boolean>>;

const NO_STEPS: StepsDone = { incense: false, beat: false, sutra: false };

/** How the last full session ended, for the end-of-session screen. */
export interface SessionResult {
  readonly rewarded: boolean;
  readonly day: string;
}

interface GameSession {
  readonly progress: PlayerProgress;
  readonly steps: StepsDone;
  readonly lastResult: SessionResult | null;
  /** Times the player held back a harsh word; journalling comes later, so this stays 0 for now. */
  readonly restraintCount: number;
  /** Marks a step done; returns true when this completed the full session (the caller shows the end screen). */
  completeStep(step: SessionStep): boolean;
  recordCombo(combo: number): void;
  updateProgress(change: (current: PlayerProgress) => PlayerProgress): void;
}

const GameSessionContext = createContext<GameSession | null>(null);

export function GameSessionProvider({ children }: { children: ReactNode }): ReactNode {
  const [progress, setProgress] = useState<PlayerProgress>(loadProgress);
  const [steps, setSteps] = useState<StepsDone>(NO_STEPS);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);

  const updateProgress = useCallback((change: (current: PlayerProgress) => PlayerProgress): void => {
    setProgress((current) => {
      const next = change(current);
      if (next !== current) saveProgress(next);
      return next;
    });
  }, []);

  const completeStep = useCallback(
    (step: SessionStep): boolean => {
      const next = { ...steps, [step]: true };
      if (!SESSION_STEPS.every((s) => next[s])) {
        setSteps(next);
        return false;
      }
      const day = localDateKey(new Date());
      // Decided from the progress this render saw; the reward cannot be granted twice because the stored day moves on.
      const outcome = completeFullSession(progress, day);
      if (outcome.rewarded) updateProgress(() => outcome.progress);
      setLastResult({ rewarded: outcome.rewarded, day });
      setSteps(NO_STEPS);
      return true;
    },
    [steps, progress, updateProgress],
  );

  const recordCombo = useCallback(
    (combo: number): void => updateProgress((current) => (combo > current.bestCombo ? { ...current, bestCombo: combo } : current)),
    [updateProgress],
  );

  const value = useMemo<GameSession>(
    () => ({ progress, steps, lastResult, restraintCount: 0, completeStep, recordCombo, updateProgress }),
    [progress, steps, lastResult, completeStep, recordCombo, updateProgress],
  );
  return <GameSessionContext value={value}>{children}</GameSessionContext>;
}

export function useGameSession(): GameSession {
  const value = useContext(GameSessionContext);
  if (!value) throw new Error('useGameSession outside GameSessionProvider');
  return value;
}
