import { TOKENS_STORAGE_KEY, liveSession, type TokenPair } from "@/lib/session"

export class ApiError extends Error {
  status: number
  /** The problem's stable `code`, which the UI translates; null when the API sends none. */
  code: string | null

  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.status = status
    this.code = code
  }
}

type ApiOptions = {
  method?: string
  accessToken?: string
  body?: unknown
}

export async function apiRequest<T = unknown>(path: string, options: ApiOptions = {}) {
  const response = await authorized(path, options, (token) => ({
    method: options.method ?? "GET",
    headers: authHeaders(token, true),
    body: options.body ? JSON.stringify(options.body) : undefined,
  }))

  if (!response.ok) {
    throw await apiError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiRequestText(path: string, options: ApiOptions = {}) {
  const response = await authorized(path, options, (token) => ({
    method: options.method ?? "GET",
    headers: authHeaders(token, false),
  }))

  if (!response.ok) {
    throw await apiError(response)
  }

  return await response.text()
}

/**
 * Sends the request with the session's current access token. Access tokens last
 * 15 minutes, so on a 401 this refreshes once and sends the request again; only
 * when the refresh itself fails is the session really over.
 */
function authHeaders(token: string | undefined, json: boolean): Record<string, string> {
  const headers: Record<string, string> = json ? { "Content-Type": "application/json" } : {}
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function authorized(path: string, options: ApiOptions, init: (token?: string) => RequestInit) {
  const session = liveSession()
  // The caller captured its token when it rendered; a refresh since then makes
  // that copy stale, so the live one wins whenever the caller wants auth at all.
  const token = options.accessToken ? session?.tokens()?.accessToken ?? options.accessToken : undefined
  const response = await fetch(`/api/backend${path}`, init(token))
  if (response.status !== 401 || !options.accessToken) return response

  const refreshed = await refreshTokens()
  if (!refreshed) {
    session?.expire()
    return response
  }

  return await fetch(`/api/backend${path}`, init(refreshed.accessToken))
}

// One refresh at a time: several requests can expire together, and the server
// rotates the refresh token, so a second attempt would present a spent one.
let refreshing: Promise<TokenPair | null> | null = null

function refreshTokens() {
  const session = liveSession()
  if (!session) return Promise.resolve(null)

  refreshing ??= (async () => {
    // Storage first: another tab may have rotated the pair since this one
    // rendered, and the server only accepts the newest refresh token.
    const current = storedTokens() ?? session.tokens()
    if (!current) return null
    try {
      const response = await fetch("/api/backend/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
      if (response.ok) {
        const next = (await response.json()) as TokenPair
        session.adopt(next)
        return next
      }
      // Lost a race with another tab: it already stored a fresh pair, take that
      // instead of ending a session that is perfectly alive.
      const latest = storedTokens()
      if (latest && latest.refreshToken !== current.refreshToken) {
        session.adopt(latest)
        return latest
      }
      return null
    } catch {
      return null
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

function storedTokens(): TokenPair | null {
  try {
    const raw = window.localStorage.getItem(TOKENS_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as TokenPair) : null
  } catch {
    return null
  }
}

/** Reads a problem JSON response: its `code` if any, and `detail` (or `title`) as the message. */
async function apiError(response: Response) {
  let message = response.statusText || `HTTP ${response.status}`
  let code: string | null = null
  try {
    const data: unknown = await response.json()
    if (typeof data === "object" && data !== null) {
      if ("code" in data && typeof data.code === "string") code = data.code
      if ("detail" in data && typeof data.detail === "string") message = data.detail
      else if ("title" in data && typeof data.title === "string") message = data.title
    }
  } catch {
    // Not JSON: keep the HTTP status text.
  }
  return new ApiError(response.status, message, code)
}
