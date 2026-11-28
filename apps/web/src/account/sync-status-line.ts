/** The one line of the account menu that says where sync stands. Pure: picks the words and formats the time. */
import { INTL_LOCALES, isLocale } from '../i18n/locales';
import type { SyncStatus } from '../sync/sync-engine';
import type { AccountTextKey } from './account-messages';

export interface StatusLine {
  readonly key: AccountTextKey;
  readonly vars?: Readonly<Record<string, string>>;
}

/** "14:05" for today, "14:05 12/11" (or the locale's order) for an older day. */
export function syncTimeLabel(at: number, now: number, locale: string): string {
  const when = new Date(at);
  const sameDay = when.toDateString() === new Date(now).toDateString();
  const options: Intl.DateTimeFormatOptions = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' };
  return new Intl.DateTimeFormat(INTL_LOCALES[isLocale(locale) ? locale : 'vi'], options).format(when);
}

/** `now` only decides whether the time needs its day; it defaults to the device clock. */
export function syncStatusLine(status: SyncStatus, locale: string, now: number = Date.now()): StatusLine {
  if (status.state === 'syncing') return { key: 'syncing' };
  if (status.state === 'offline') return { key: 'offline' };
  if (status.state === 'error') return { key: 'error' };
  if (status.lastSyncedAt === null) return { key: 'notSynced' };
  return { key: 'syncedAt', vars: { time: syncTimeLabel(status.lastSyncedAt, now, locale) } };
}
