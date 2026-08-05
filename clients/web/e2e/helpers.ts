import type { Locator, Page } from "@playwright/test"

import { apiLogin } from "./stack"

// Pre-seeds the app's localStorage session so specs skip the interactive login.
// The UI login journey itself is covered by 01-setup-overview.spec.ts.
export async function seedSession(page: Page, locale: "de" | "en") {
  const tokens = await apiLogin()
  await page.addInitScript(
    (state: { tokens: string; locale: string }) => {
      window.localStorage.setItem("household.tokens", state.tokens)
      window.localStorage.setItem("household.locale", state.locale)
    },
    { tokens: JSON.stringify(tokens), locale },
  )
}

// FormSelect renders a native <select>; picking means selecting by option label.
export async function pickOption(select: Locator, label: string) {
  await select.selectOption({ label })
}
