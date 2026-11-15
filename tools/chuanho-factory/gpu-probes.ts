/**
 * Probes the idle gate reads: GPU load from nvidia-smi, ComfyUI's queue length from its HTTP API, and artgen's
 * `--health`. Parsers are pure; the probes take the command runner and fetch as arguments.
 */
import path from 'node:path';
import { lastJsonLine, type RunCommand } from './process-runner';

export interface GpuSample {
  /** Highest utilisation across GPUs, percent. */
  readonly utilPercent: number;
  /** Least free memory across GPUs, MiB. */
  readonly freeMiB: number;
}

/** `nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits` output. */
export function parseNvidiaSmi(text: string): GpuSample | undefined {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => Number(cell.trim())))
    .filter((cells) => cells.length === 3 && cells.every((n) => Number.isFinite(n)));
  if (rows.length === 0) return undefined;
  return {
    utilPercent: Math.max(...rows.map((r) => r[0] ?? 0)),
    freeMiB: Math.min(...rows.map((r) => (r[2] ?? 0) - (r[1] ?? 0))),
  };
}

export const NVIDIA_SMI_ARGS = ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'] as const;

/** undefined when nvidia-smi is missing or unreadable (the gate then relies on ComfyUI's queue and health). */
export async function probeGpu(run: RunCommand): Promise<GpuSample | undefined> {
  try {
    const result = await run('nvidia-smi', NVIDIA_SMI_ARGS, { timeoutMs: 15_000 });
    return result.code === 0 ? parseNvidiaSmi(result.stdout) : undefined;
  } catch {
    return undefined;
  }
}

/** ComfyUI `/queue`: running plus pending prompts. */
export function parseComfyQueue(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { queue_running: running, queue_pending: pending } = body as Record<string, unknown>;
  if (!Array.isArray(running) || !Array.isArray(pending)) return undefined;
  return running.length + pending.length;
}

export type FetchJson = (url: string, timeoutMs: number) => Promise<unknown>;

export const fetchJson: FetchJson = async (url, timeoutMs) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.json()) as unknown;
};

/** undefined when ComfyUI does not answer (the health probe reports that case). */
export async function probeComfyQueue(comfyUrl: string, fetcher: FetchJson = fetchJson): Promise<number | undefined> {
  try {
    return parseComfyQueue(await fetcher(`${comfyUrl}/queue`, 10_000));
  } catch {
    return undefined;
  }
}

export interface HealthReport {
  readonly ok: boolean;
  readonly detail: string;
}

/** `artgen.py --health`: one JSON line with `ok`. */
export async function probeHealth(run: RunCommand, python: string, artgenDir: string): Promise<HealthReport> {
  try {
    const result = await run(python, [path.join(artgenDir, 'artgen.py'), '--health'], { timeoutMs: 60_000 });
    const reply = lastJsonLine(result.stdout);
    if (result.code === 0 && reply?.ok === true) return { ok: true, detail: 'artgen --health ok' };
    const error = typeof reply?.error === 'string' ? reply.error : result.stderr.trim().slice(-300) || `exit ${result.code}`;
    return { ok: false, detail: `artgen --health failed: ${error}` };
  } catch (error) {
    return { ok: false, detail: `artgen --health could not run: ${error instanceof Error ? error.message : String(error)}` };
  }
}
