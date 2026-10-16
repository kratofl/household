// Turns API and unknown errors into a message in the user's language. The API's own text
// is English prose, so it is never shown: the problem's code picks the copy, otherwise the
// HTTP status does.

import { ApiError } from "@/lib/api"

import type { TranslationKey, Translator } from "@/lib/i18n"

const problemCopy = new Map<string, TranslationKey>([
  ["invalid_login", "error.api.invalidLogin"],
  ["user_inactive", "error.api.userInactive"],
  ["account_pending", "error.api.accountPending"],
  ["session_expired", "error.api.sessionExpired"],
  ["admin_required", "error.adminRequired"],
  ["user_fields_required", "error.api.userFieldsRequired"],
  ["user_exists", "error.api.userExists"],
  ["invalid_user_change", "error.api.invalidUserChange"],
  ["own_account", "error.api.ownAccount"],
  ["user_not_found", "error.api.userNotFound"],
  ["unknown_theme", "error.api.unknownTheme"],
  ["new_password_required", "error.api.newPasswordRequired"],
  ["current_password_incorrect", "error.api.currentPasswordIncorrect"],
  ["only_sign_in_method", "error.api.onlySignInMethod"],
  ["invalid_module", "error.api.invalidModule"],
  ["invalid_limit", "error.api.invalidLimit"],
  ["invalid_redirect", "error.api.invalidRedirect"],
  ["sign_in_required", "error.api.signInRequired"],
  ["login_expired", "error.api.loginExpired"],
  ["provider_login_failed", "error.api.providerLoginFailed"],
  ["provider_already_linked", "error.api.providerAlreadyLinked"],
  ["provider_email_missing", "error.api.providerEmailMissing"],
  ["provider_account_exists", "error.api.providerAccountExists"],
  ["provider_not_configured", "error.api.providerNotConfigured"],
  ["provider_unavailable", "error.api.providerUnavailable"],
])

function statusCopy(status: number): TranslationKey {
  if (status === 400 || status === 422) return "error.status.invalid"
  if (status === 401) return "error.api.sessionExpired"
  if (status === 403) return "error.status.forbidden"
  if (status === 404) return "error.status.notFound"
  if (status === 409) return "error.status.conflict"
  if (status >= 500) return "error.status.unavailable"
  return "error.unexpected"
}

export function errorMessage(err: unknown, t: Translator) {
  if (err instanceof ApiError) return t((err.code === null ? undefined : problemCopy.get(err.code)) ?? statusCopy(err.status))
  // fetch() rejects with a TypeError when the server cannot be reached at all.
  if (err instanceof TypeError) return t("error.network")
  return t("error.unexpected")
}
