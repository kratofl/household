// Session types and storage keys shared by the shell and its panels.

export type TokenPair = {
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
}

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  status: "pending" | "active" | "blocked"
  /** Accent theme id; see lib/theme.ts. */
  theme: string
}

export const TOKENS_STORAGE_KEY = "household.tokens"

export const LOCALE_STORAGE_KEY = "household.locale"

/**
 * The one signed-in session. The app shell registers it after login; api.ts uses
 * it to refresh an expired access token and, when the refresh token is gone too,
 * to hand control back to the login screen instead of leaving the user clicking
 * into errors.
 */
export type LiveSession = {
  tokens: () => TokenPair | null
  adopt: (tokens: TokenPair) => void
  expire: () => void
}

let live: LiveSession | null = null

export function registerSession(session: LiveSession | null) {
  live = session
}

export function liveSession() {
  return live
}
