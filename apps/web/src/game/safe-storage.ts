/**
 * localStorage that never breaks the app: private mode, a full quota, a disabled store or corrupt JSON all fall
 * back to "nothing stored" (reads) or "not saved" (writes), with a console warning for whoever debugs it.
 */

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (error) {
    console.warn('localStorage unavailable', error);
    return null;
  }
}

/** The stored value of `key` if it parses and passes `parse`, otherwise null. */
export function readStored<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  try {
    const text = storage()?.getItem(key);
    if (text === null || text === undefined) return null;
    return parse(JSON.parse(text));
  } catch (error) {
    console.warn(`Ignoring unreadable stored ${key}`, error);
    return null;
  }
}

/** Stores `value` as JSON; returns false when the browser refused. */
export function writeStored(key: string, value: unknown): boolean {
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${key}`, error);
    return false;
  }
}
