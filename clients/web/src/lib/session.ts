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
