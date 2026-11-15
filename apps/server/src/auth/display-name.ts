/**
 * The short name shown for a signed-in account, from the IdP's userinfo answer. Only the given name is kept: Vietnamese
 * names put it last ("Nguyễn Văn An" -> "An"), and the account's username stands in when there is no name. Anything
 * shaped like an email address is refused, so an address never reaches the database.
 */

/** What the app keeps of the IdP's userinfo. */
export interface AccountProfile {
  displayName: string | null;
}

export const DISPLAY_NAME_MAX = 24;

/** A trimmed single word of at most DISPLAY_NAME_MAX characters, never an email address; null otherwise. */
function shortWord(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const word = value.trim().split(/\s+/).at(-1) ?? '';
  if (word === '' || word.length > DISPLAY_NAME_MAX || word.includes('@')) return null;
  return word;
}

/** The given name of a full name (its last word), else the username; null when neither is usable. */
export function displayNameOf(name: unknown, username: unknown): string | null {
  return shortWord(name) ?? shortWord(username);
}

/**
 * The profile in a userinfo answer, or null when it is not about `sub` (OIDC Core 5.3.2: the userinfo `sub` must
 * match the ID token's, or the answer is not used).
 */
export function profileFromUserinfo(body: unknown, sub: string): AccountProfile | null {
  if (typeof body !== 'object' || body === null) return null;
  const claims = body as Record<string, unknown>;
  if (claims.sub !== sub) return null;
  return { displayName: displayNameOf(claims.name, claims.preferred_username) };
}
