let cachedAccessToken: string | null = null;
let cachedExpiresAt = 0;

export type MinimalAuthSession = { access_token?: string; expires_at?: number } | null;

export function setAuthTokenSession(session: MinimalAuthSession) {
  cachedAccessToken = session?.access_token ?? null;
  cachedExpiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
}

export function getCachedAccessToken(): string | null {
  return cachedAccessToken && cachedExpiresAt - Date.now() > 60_000 ? cachedAccessToken : null;
}
