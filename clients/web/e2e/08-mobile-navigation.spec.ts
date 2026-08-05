import { expect, test } from "@playwright/test"

import { seedSession } from "./helpers"

// Journey: every core Budget destination stays usable on a phone viewport in
// German (stories 13, 106-107).
test("mobile navigation reaches every budget destination @mobile", async ({ page }) => {
  await seedSession(page, "de")

  const destinations: Array<[string, string]> = [
    ["/budget", "Erinnerungen"],
    ["/budget/transactions", "Neue Ausgabe"],
    ["/budget/planning", "Wiederkehrende Einnahmen"],
    ["/budget/saving-investing", "Sparzwecke"],
    ["/budget/wishlist", "Finanzielle Wunschliste"],
    ["/budget/categories", "Kategorie anlegen"],
    ["/budget/reports", "Periodenvergleich"],
    ["/budget/settings", "CSV-Import"],
  ]
  for (const [route, marker] of destinations) {
    await page.goto(route)
    await expect(page.getByText(marker).first()).toBeVisible()
  }

  await page.goto("/budget/reports")
  let focusedTag = ""
  for (let step = 0; step < 5 && !["A", "BUTTON", "INPUT", "SELECT"].includes(focusedTag); step++) {
    await page.keyboard.press("Tab")
    focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "")
  }
  expect(["A", "BUTTON", "INPUT", "SELECT"]).toContain(focusedTag)
})
