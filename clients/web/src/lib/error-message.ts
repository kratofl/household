// Turns API/unknown errors into a user-facing message.

import { ApiError } from "@/lib/api"

import type { Translator } from "@/lib/i18n"

export function errorMessage(err: unknown, t: Translator) {
  if (err instanceof ApiError) {
    return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return t("error.unexpected")
}
