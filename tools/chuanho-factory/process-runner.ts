/**
 * The only place the factory starts other programs (Python tools, ffmpeg, nvidia-smi). Everything else receives a
 * `RunCommand` so tests inject canned results. No shell: arguments go to the program as they are.
 */
import { spawn } from 'node:child_process';

export interface CommandResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface CommandOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  /** Aborting kills the child this call started (and nothing else). */
  readonly signal?: AbortSignal;
}

export type RunCommand = (command: string, args: readonly string[], options?: CommandOptions) => Promise<CommandResult>;

const MAX_CAPTURE = 4 * 1024 * 1024;

function keepTail(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length > MAX_CAPTURE ? next.slice(next.length - MAX_CAPTURE) : next;
}

export const runCommand: RunCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new Error(`aborted before starting ${command}`));
      return;
    }
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      windowsHide: true,
      // Python tools print Vietnamese; force UTF-8 whatever the console code page is.
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let reason: string | undefined;
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout = keepTail(stdout, chunk);
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = keepTail(stderr, chunk);
    });
    const stop = (why: string): void => {
      reason = why;
      child.kill();
    };
    const onAbort = (): void => stop('aborted');
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = options.timeoutMs ? setTimeout(() => stop(`timed out after ${options.timeoutMs} ms`), options.timeoutMs) : undefined;
    const cleanup = (): void => {
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    child.on('error', (error) => {
      cleanup();
      reject(new Error(`could not start ${command}: ${error.message}`));
    });
    child.on('close', (code) => {
      cleanup();
      if (reason) reject(new Error(`${command} ${reason}`));
      else resolve({ code: code ?? 1, stdout, stderr });
    });
  });

/** Runs a command and returns stdout; a non-zero exit becomes an error carrying the end of stderr. */
export async function runChecked(run: RunCommand, command: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult> {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    const tail = (result.stderr.trim() || result.stdout.trim()).slice(-800);
    throw new Error(`${command} exited ${result.code}: ${tail}`);
  }
  return result;
}

/** Last line of stdout that parses as a JSON object (the artgen/voice tools print one result line). */
export function lastJsonLine(stdout: string): Record<string, unknown> | undefined {
  const lines = stdout.split(/\r?\n/).reverse();
  for (const line of lines) {
    const text = line.trim();
    if (!text.startsWith('{')) continue;
    try {
      const value: unknown = JSON.parse(text);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      // not JSON; keep looking
    }
  }
  return undefined;
}
