/**
 * Durable queue state: one JSON line per change in `<state dir>/queue.jsonl`, outside the repo. A line is
 * `{"type":"job","job":{...}}` or `{"type":"removal","removal":{...}}`; for a job the last line of an id wins.
 * Appends are small single writes, so a crash loses at most a half-written last line, which loading skips. When the
 * file holds many superseded lines it is compacted to a temporary file and renamed over the old one.
 */
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseJobParams } from './job-params';
import { isJobStatus, type Job, type TrackRemoval } from './job-types';

export interface QueueState {
  readonly jobs: readonly Job[];
  readonly removals: readonly TrackRemoval[];
  /** Lines that could not be read (a torn last write, a hand edit gone wrong). */
  readonly skippedLines: number;
}

type Line = { type: 'job'; job: Job } | { type: 'removal'; removal: TrackRemoval };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function parseJob(raw: unknown): Job | undefined {
  const r = asRecord(raw);
  if (!r || typeof r.id !== 'string' || !isJobStatus(r.status)) return undefined;
  if (typeof r.attempts !== 'number' || typeof r.maxAttempts !== 'number') return undefined;
  if (typeof r.createdAt !== 'string' || typeof r.updatedAt !== 'string') return undefined;
  const parsed = parseJobParams(r.params);
  if (!('params' in parsed)) return undefined;
  // Remaining optional fields were written by this tool; their shape is checked where they are displayed.
  return { ...(r as unknown as Job), params: parsed.params };
}

function parseRemoval(raw: unknown): TrackRemoval | undefined {
  const r = asRecord(raw);
  if (!r || typeof r.trackId !== 'string' || typeof r.reason !== 'string' || typeof r.at !== 'string') return undefined;
  return { trackId: r.trackId, reason: r.reason, at: r.at };
}

/** Reads the state text; pure, so tests feed it strings. */
export function parseState(text: string): QueueState {
  const jobs = new Map<string, Job>();
  const removals = new Map<string, TrackRemoval>();
  let skippedLines = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record: Record<string, unknown> | undefined;
    try {
      record = asRecord(JSON.parse(line));
    } catch {
      record = undefined;
    }
    const job = record?.type === 'job' ? parseJob(record.job) : undefined;
    const removal = record?.type === 'removal' ? parseRemoval(record.removal) : undefined;
    if (job) {
      jobs.delete(job.id); // keep insertion order = order of the latest change
      jobs.set(job.id, job);
    } else if (removal) {
      removals.set(removal.trackId, removal);
    } else {
      skippedLines += 1;
    }
  }
  return { jobs: [...jobs.values()], removals: [...removals.values()], skippedLines };
}

export function serializeLine(line: Line): string {
  return `${JSON.stringify(line)}\n`;
}

export class JobStore {
  private readonly file: string;
  private lineCount = 0;

  constructor(stateDir: string) {
    this.file = path.join(stateDir, 'queue.jsonl');
  }

  get path(): string {
    return this.file;
  }

  async load(): Promise<QueueState> {
    let text = '';
    try {
      text = await readFile(this.file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    this.lineCount = text.split('\n').filter((line) => line.trim()).length;
    return parseState(text);
  }

  async saveJob(job: Job): Promise<void> {
    await this.append({ type: 'job', job });
  }

  async saveRemoval(removal: TrackRemoval): Promise<void> {
    await this.append({ type: 'removal', removal });
  }

  /** Rewrites the file with only the latest line of each job when superseded lines dominate. */
  async compactIfNeeded(state: QueueState): Promise<boolean> {
    const live = state.jobs.length + state.removals.length;
    if (this.lineCount < 200 || this.lineCount < live * 4) return false;
    const body = [...state.jobs.map((job): Line => ({ type: 'job', job })), ...state.removals.map((removal): Line => ({ type: 'removal', removal }))]
      .map(serializeLine)
      .join('');
    const temp = `${this.file}.tmp-${process.pid}`;
    await writeFile(temp, body, 'utf8');
    await rename(temp, this.file);
    this.lineCount = live;
    return true;
  }

  private async append(line: Line): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, serializeLine(line), 'utf8');
    this.lineCount += 1;
  }
}
