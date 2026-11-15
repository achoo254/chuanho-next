/** Window timeouts owned by one object, so stopping it cancels every callback it still had pending. */

export interface TimerSet {
  /** Runs `fn` after `ms`, unless `clear` comes first. */
  readonly later: (fn: () => void, ms: number) => void;
  readonly clear: () => void;
}

export function createTimerSet(): TimerSet {
  const ids = new Set<number>();
  return {
    later: (fn, ms) => {
      const id = window.setTimeout(() => {
        ids.delete(id);
        fn();
      }, ms);
      ids.add(id);
    },
    clear: () => {
      for (const id of ids) window.clearTimeout(id);
      ids.clear();
    },
  };
}
