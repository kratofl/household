import { expect, test } from "@playwright/test"

import { pickOption, seedSession } from "./helpers"

// Journey: fixed reports with category filtering and reset in German
// (stories 99-100), fed by the data earlier specs created.
test("reports show filterable spending data in German", async ({ page }) => {
  await seedSession(page, "de")
  await page.goto("/budget/reports")

  await expect(page.getByRole("heading", { name: "Periodenvergleich" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Ausgaben nach Kategorie" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Plan vs. Ist" })).toBeVisible()

  const categoryCard = page
    .locator("div.rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: "Ausgaben nach Kategorie" }) })
  await expect(categoryCard.locator("p", { hasText: "Lebensmittel" }).first()).toBeVisible()

  const filterCard = page
    .locator("div.rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: "Berichte" }) })
  await pickOption(filterCard.locator("select").first(), "Lebensmittel")
  await page.getByRole("button", { name: "Filter anwenden" }).click()
  await expect(categoryCard.locator("p", { hasText: "Lebensmittel" }).first()).toBeVisible()
  await expect(categoryCard.locator("p", { hasText: "Flexibel" })).toHaveCount(0)

  await page.getByRole("button", { name: "Filter zuruecksetzen" }).click()
  await expect(page.getByRole("heading", { name: "Investitionen" })).toBeVisible()
})
