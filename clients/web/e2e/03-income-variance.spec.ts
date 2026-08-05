import { expect, test } from "@playwright/test"

import { seedSession } from "./helpers"

// Journey: recurring income plan, manual confirmation with an income shortfall,
// and visible variance in German (stories 20-29).
test("income confirmation shows variance in German", async ({ page }) => {
  await seedSession(page, "de")
  await page.goto("/budget/planning")

  const incomeCard = page
    .locator("div.rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: "Wiederkehrende Einnahmen" }) })
  await incomeCard.getByPlaceholder("z. B. Gehalt").fill("Gehalt E2E")
  await incomeCard.getByPlaceholder("Betrag").first().fill("1000")
  await incomeCard.getByLabel("Startdatum").fill("2026-08-01")
  await incomeCard.getByRole("button", { name: "Einnahmeplan anlegen" }).click()
  await expect(incomeCard.locator("p", { hasText: "Gehalt E2E" }).first()).toBeVisible()

  await incomeCard.getByRole("button", { name: "Bestaetigen", exact: true }).first().click()
  await incomeCard.getByPlaceholder("Betrag").last().fill("900")
  await incomeCard.getByLabel("Wirksamkeitsdatum").fill("2026-08-01")
  await incomeCard.getByRole("button", { name: "Aktion bestaetigen" }).click()

  await expect(incomeCard.locator("p", { hasText: "bestaetigt" }).first()).toBeVisible()
  await expect(incomeCard.locator("p", { hasText: "Abweichung" }).first()).toBeVisible()
})
