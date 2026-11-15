/**
 * One runner per state directory: `<state dir>/runner.lock` holds the owner's pid. A lock whose pid is no longer
 * alive (crash, power cut) is taken over; a live one makes the second runner refuse to start, so two heavy jobs
 * never run at once even when the scheduled task and a manual `run` overlap.
 */
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export type IsAlive = (pid: number) => boolean;

/** `process.kill(pid, 0)` checks existence without sending a signal; EPERM still means the process exists. */
export const processIsAlive: IsAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

export interface RunnerLock {
  release(): Promise<void>;
}

export async function acquireRunnerLock(stateDir: string, pid: number = process.pid, isAlive: IsAlive = processIsAlive): Promise<RunnerLock> {
  await mkdir(stateDir, { recursive: true });
  const file = path.join(stateDir, 'runner.lock');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(file, 'wx');
      await handle.writeFile(`${pid}\n`, 'utf8');
      await handle.close();
      return {
        release: async (): Promise<void> => {
          const owner = await readFile(file, 'utf8').catch(() => '');
          if (Number.parseInt(owner, 10) === pid) await unlink(file).catch(() => undefined);
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const owner = Number.parseInt(await readFile(file, 'utf8').catch(() => ''), 10);
      if (Number.isInteger(owner) && owner > 0 && isAlive(owner)) {
        throw new Error(`another runner (pid ${owner}) holds ${file}`, { cause: error });
      }
      await unlink(file).catch(() => undefined); // stale: its owner is gone
    }
  }
  throw new Error(`could not take ${file}`);
}
