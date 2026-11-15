/**
 * Reads what tools/chuanho-music produced: the raw folder's jobs.jsonl (which ids exist) and qc_music.py's
 * qc-report.json (rejected with reasons, near-duplicates, kept, unused beyond the hours cap). The factory never
 * re-implements those checks; it turns the report into per-track QC items.
 */
import type { QcItem } from './job-types';

export interface MusicQcReport {
  readonly rejected: Readonly<Record<string, readonly string[]>>;
  readonly duplicates: Readonly<Record<string, string>>;
  readonly kept: readonly string[];
  readonly unused: readonly string[];
  readonly summary: Readonly<Record<string, number>>;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function parseMusicQcReport(raw: unknown): MusicQcReport {
  const r = record(raw);
  if (!Array.isArray(r.kept)) throw new Error('qc-report.json has no "kept" list');
  const rejected: Record<string, string[]> = {};
  for (const [id, reasons] of Object.entries(record(r.rejected))) rejected[id] = stringList(reasons);
  const duplicates: Record<string, string> = {};
  for (const [id, twin] of Object.entries(record(r.duplicates))) if (typeof twin === 'string') duplicates[id] = twin;
  const summary: Record<string, number> = {};
  for (const [key, value] of Object.entries(record(r.summary))) if (typeof value === 'number') summary[key] = value;
  return { rejected, duplicates, kept: stringList(r.kept), unused: stringList(r.unused), summary };
}

/** Track ids of jobs.jsonl (successful or not), so the next batch continues after the highest one. */
export function rawTrackIds(jobsJsonl: string): { ids: string[]; failed: string[] } {
  const ids: string[] = [];
  const failed: string[] = [];
  for (const line of jobsJsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const entry = record(JSON.parse(line));
      if (typeof entry.id !== 'string') continue;
      ids.push(entry.id);
      if ('error' in entry) failed.push(entry.id);
    } catch {
      // a torn line from an interrupted run; generate_music.py rewrites nothing, so skip it
    }
  }
  return { ids, failed };
}

/** 1-based number of the next track: after every m### seen in files or the job log. */
export function nextTrackNumber(names: readonly string[]): number {
  let highest = 0;
  for (const name of names) {
    const match = /^m(\d{3,})(?:\.mp3)?$/.exec(name);
    if (match?.[1]) highest = Math.max(highest, Number(match[1]));
  }
  return highest + 1;
}

export function trackIdFor(number: number): string {
  return `m${String(number).padStart(3, '0')}`;
}

/** QC items for the tracks of one batch. */
export function batchQcItems(report: MusicQcReport, batch: readonly string[], generated: ReadonlySet<string>): QcItem[] {
  return batch.map((id): QcItem => {
    if (!generated.has(id)) return { item: id, passed: false, checks: [{ name: 'generated', ok: false, detail: 'ComfyUI produced no file' }] };
    const reasons = report.rejected[id];
    if (reasons) return { item: id, passed: false, checks: reasons.map((reason) => ({ name: reason.split(' ')[0] ?? 'qc', ok: false, detail: reason })) };
    const twin = report.duplicates[id];
    if (twin) return { item: id, passed: false, checks: [{ name: 'duplicate', ok: false, detail: `too close to ${twin}` }] };
    if (report.kept.includes(id)) return { item: id, passed: true, checks: [{ name: 'qc_music', ok: true, detail: 'kept in the library' }] };
    if (report.unused.includes(id)) return { item: id, passed: false, checks: [{ name: 'library-cap', ok: false, detail: 'passed QC but the library is full (calmer tracks kept)' }] };
    return { item: id, passed: false, checks: [{ name: 'qc_music', ok: false, detail: 'not in the report (missing from jobs.jsonl?)' }] };
  });
}
