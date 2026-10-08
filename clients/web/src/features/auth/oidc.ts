// Login through the OIDC provider (for example Pocket ID). The API runs the flow and keeps the
// client secret; the browser follows the authorization URL and hands the callback back. Each tab
// remembers the state it started with, so a callback link it did not start (someone else's login
// pushed onto this browser) is refused before it reaches the API.

import { apiRequest } from "@/lib/api"
import type { TokenPair } from "@/lib/session"

export type OidcOffer = { enabled: true; name: string } | { enabled: false; name: null }

export type OidcCompletion =
  | { kind: "signedIn"; tokens: TokenPair }
  | { kind: "linked" }
  | { kind: "rejected" }

/** Where the provider sends the browser back to; register `<origin>/auth/callback` at the provider. */
export const OIDC_CALLBACK_PATH = "/auth/callback"

const STATE_STORAGE_KEY = "household.oidc.state"

export async function loadOidcOffer(): Promise<OidcOffer> {
  try {
    return await apiRequest<OidcOffer>("/auth/oidc")
  } catch {
    return { enabled: false, name: null }
  }
}

/**
 * Leaves the app for the provider. Without an access token it signs in; with one it links the
 * provider to that signed-in account.
 */
export async function startOidc(accessToken?: string) {
  const { authorizationUrl } = await apiRequest<{ authorizationUrl: string }>("/auth/oidc/start", {
    method: "POST",
    accessToken,
    body: { redirectUri: `${window.location.origin}${OIDC_CALLBACK_PATH}`, link: accessToken !== undefined },
  })
  window.sessionStorage.setItem(STATE_STORAGE_KEY, new URL(authorizationUrl).searchParams.get("state") ?? "")
  window.location.assign(authorizationUrl)
}

/** Finishes the login this tab started. Throws ApiError when the API refuses it. */
export async function completeOidc(search: URLSearchParams): Promise<OidcCompletion> {
  const expectedState = window.sessionStorage.getItem(STATE_STORAGE_KEY)
  window.sessionStorage.removeItem(STATE_STORAGE_KEY)
  const code = search.get("code")
  const state = search.get("state")
  if (!code || !state || state !== expectedState) return { kind: "rejected" }

  const tokens = await apiRequest<TokenPair | undefined>("/auth/oidc/callback", {
    method: "POST",
    body: { code, state },
  })
  return tokens ? { kind: "signedIn", tokens } : { kind: "linked" }
}
