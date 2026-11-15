/**
 * The player's progress as a synced collection: always sent whole (it is a handful of counters), and the server's
 * merged answer is adopted. Pending while it differs from the last version the server returned.
 */
import type { ProgressDoc } from '@chuanho/contract';
import type { PlayerProgress } from '../game/player-progress';
import { sameProgressDoc, toProgressDoc } from './progress-doc';
import type { SyncedCollection } from './synced-collection';

export interface ProgressSource {
  /** The progress the device has now. */
  read(): PlayerProgress;
  /** Folds the server's merged progress into the device's (see adoptServerProgress). */
  adopt(server: ProgressDoc): void;
}

export function createProgressCollection(source: ProgressSource): SyncedCollection {
  let lastServer: ProgressDoc | null = null;
  return {
    key: 'progress',
    collect: () => ({ progress: toProgressDoc(source.read()) }),
    hasPending: () => lastServer === null || !sameProgressDoc(toProgressDoc(source.read()), lastServer),
    apply(response) {
      lastServer = response.progress;
      source.adopt(response.progress);
    },
    reset() {
      lastServer = null;
    },
  };
}
