/** Journal fixtures and a POST /api/sync caller for the sync tests. */
import { EMPTY_PROGRESS, type JournalEntry, type ProgressDoc, type SyncResponse } from '@chuanho/contract';
import { expect } from 'vitest';
import { api } from './sign-in';
import type { TestServer } from './test-server';

export const journalEntry = (id: string, updatedAt: number, change: Partial<JournalEntry> = {}): JournalEntry => ({
  id,
  day: '2026-11-15',
  kind: 'harsh',
  note: `ghi chú ${id}`,
  released: { reset: false, apology: false, deed: false },
  createdAt: 1_700_000_000_000,
  updatedAt,
  deletedAt: null,
  ...change,
});

export const progressOf = (change: Partial<ProgressDoc>): ProgressDoc => ({ ...EMPTY_PROGRESS, ...change });

export interface SyncBody {
  readonly progress: ProgressDoc;
  readonly journal: readonly JournalEntry[];
  readonly cursor: number;
  /** Omitted: 0, a device that never synced this account. */
  readonly epoch?: number;
}

export const postSync = (server: TestServer, session: string, body: SyncBody): Promise<Response> =>
  api(server, '/api/sync', { method: 'POST', cookie: session, body: JSON.stringify(body) });

/** A sync that must succeed. */
export async function syncOk(server: TestServer, session: string, body: SyncBody): Promise<SyncResponse> {
  const res = await postSync(server, session, body);
  expect(res.status).toBe(200);
  return (await res.json()) as SyncResponse;
}
