import { expect, test } from "@playwright/test"

import { pickOption, seedSession } from "./helpers"

// Journey: rate-driven savings goal with a first allocated contribution in
// German (stories 82-89).
test("savings goal and contribution build progress in German", async ({ page }) => {
  await seedSession(page, "de")
  await page.goto("/budget/saving-investing")

  const goalsCard = page
    .locator("div.rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: "Sparzwecke" }) })
  await goalsCard.getByPlaceholder("Name des Sparziels").fill("Notgroschen E2E")
  await goalsCard.getByPlaceholder("Zielbetrag").fill("500")
  await pickOption(goalsCard.locator("select").filter({ hasText: "Terminbasiert" }).first(), "Ratenbasiert")
  await goalsCard.getByPlaceholder("Regelmaessiger Beitrag").fill("100")
  await goalsCard.getByRole("button", { name: "Sparziel anlegen" }).click()
  await expect(goalsCard.locator("p", { hasText: "Notgroschen E2E" }).first()).toBeVisible()

  const fundingCard = page
    .locator("div.rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: "Sparwert erfassen" }) })
  await fundingCard.getByPlaceholder("Beschreibung").fill("Erster Beitrag E2E")
  await fundingCard.getByPlaceholder("Betrag").first().fill("100")
  await pickOption(fundingCard.locator("select").filter({ hasText: "Sparzweck auswaehlen" }).first(), "Notgroschen E2E")
  await fundingCard.getByPlaceholder("Betrag").last().fill("100")
  await fundingCard.getByRole("button", { name: "Sparwert speichern" }).click()

  await expect(goalsCard.locator("p", { hasText: "Zugeordnet" }).first()).toBeVisible()
  await expect(page.getByText("Gesamtes Sparguthaben")).toBeVisible()
})
