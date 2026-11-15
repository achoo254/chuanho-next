/**
 * Validation of job parameters, at the two boundaries where they enter: the CLI (`enqueue`) and the state file.
 * Bounds keep a typo from queuing a week of GPU work.
 */
import { isTimeOfDay, type JobParams, type TimeOfDay } from './job-types';

export const MUSIC_BATCH_MAX = 60;
export const VIDEO_SECONDS_MIN = 15;
export const VIDEO_SECONDS_MAX = 60;
const VERSE_ID = /^[a-z0-9-]{1,40}$/;

type Fields = Record<string, unknown>;

function fields(raw: unknown): Fields | undefined {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Fields) : undefined;
}

function times(raw: unknown): TimeOfDay[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const list = raw.filter(isTimeOfDay);
  return list.length === raw.length ? [...new Set(list)] : undefined;
}

/** Parses job parameters or explains what is wrong. */
export function parseJobParams(raw: unknown): { params: JobParams } | { error: string } {
  const f = fields(raw);
  if (!f) return { error: 'params must be an object' };
  switch (f.kind) {
    case 'music': {
      const count = f.count;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MUSIC_BATCH_MAX) {
        return { error: `music count must be an integer 1-${MUSIC_BATCH_MAX}` };
      }
      return { params: { kind: 'music', count } };
    }
    case 'scene': {
      const list = times(f.times);
      return list ? { params: { kind: 'scene', times: list } } : { error: 'scene times must be a non-empty list of morning, noon, evening, night' };
    }
    case 'verse-voice': {
      const ids = f.verseIds ?? [];
      if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && VERSE_ID.test(id))) {
        return { error: 'verseIds must be a list of verse ids' };
      }
      return { params: { kind: 'verse-voice', verseIds: ids as string[] } };
    }
    case 'video': {
      const seconds = f.seconds;
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < VIDEO_SECONDS_MIN || seconds > VIDEO_SECONDS_MAX) {
        return { error: `video seconds must be ${VIDEO_SECONDS_MIN}-${VIDEO_SECONDS_MAX}` };
      }
      const time = f.time;
      if (time !== undefined && !isTimeOfDay(time)) return { error: 'video time must be morning, noon, evening or night' };
      if (typeof f.withVoice !== 'boolean') return { error: 'video withVoice must be true or false' };
      return { params: { kind: 'video', seconds, withVoice: f.withVoice, ...(isTimeOfDay(time) ? { time } : {}) } };
    }
    case 'beatmap':
      return { params: { kind: 'beatmap' } };
    case 'publish-library':
      return { params: { kind: 'publish-library' } };
    default:
      return { error: `unknown job kind ${String(f.kind)}` };
  }
}
