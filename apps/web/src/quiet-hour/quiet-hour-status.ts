/**
 * Reads `QuietHourStatus` (the answer of GET /api/quiet-hour and POST /api/quiet-hour/beats). The contract has the
 * type but no parser, so the web checks the shape here: anything off is rejected as a whole (a half-read status
 * would show a wrong countdown).
 */
import { type QuietHourStatus, isCount, isDayKey, isEpochMs, isRecord } from '@chuanho/contract';

export function parseQuietHourStatus(raw: unknown): QuietHourStatus | null {
  if (!isRecord(raw)) return null;
  const { day, open, startsAt, endsAt, total, milestones, serverNow } = raw;
  if (!isDayKey(day) || typeof open !== 'boolean' || !isEpochMs(startsAt) || !isEpochMs(endsAt) || !isEpochMs(serverNow)) return null;
  if (endsAt <= startsAt || !isCount(total, Number.MAX_SAFE_INTEGER) || !Array.isArray(milestones)) return null;
  const marks = milestones.filter((mark): mark is number => isCount(mark, Number.MAX_SAFE_INTEGER));
  if (marks.length !== milestones.length) return null;
  return { day, open, startsAt, endsAt, total, milestones: marks, serverNow };
}
