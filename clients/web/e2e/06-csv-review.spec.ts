import { expect, test } from "@playwright/test"

import { seedSession } from "./helpers"

// Journey: staged CSV review import with validation and duplicate feedback in
// English (stories 102-103).
test("csv import review flow validates before committing in English", async ({ page }) => {
  await seedSession(page, "en")
  await page.goto("/budget/settings")
  await expect(page.getByText("CSV import")).toBeVisible()

  const csv = [
    "Datum;Art;Beschreibung;Betrag;Kategorie;Haendler",
    "15.07.2026;Ausgabe;Wocheneinkauf E2E;45,90;Lebensmittel;REWE",
    "16.07.2026;Einnahme;Gehalt E2E Import;2.500,00;;",
    "32.07.2026;Ausgabe;Kaputt;5,00;;",
  ].join("\n")
  await page.getByLabel("CSV file").setInputFiles({
    name: "haushalt.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  })
  await expect(page.getByText("3 rows staged")).toBeVisible()

  await page.getByRole("button", { name: "Update preview" }).click()
  await expect(page.getByText("2 valid")).toBeVisible()
  await expect(page.getByText("1 invalid")).toBeVisible()
  await expect(page.getByText("Invalid date").first()).toBeVisible()

  await page.getByRole("button", { name: "Confirm import" }).click()
  await expect(page.getByText("2 imported, 1 invalid skipped, 0 duplicates skipped.")).toBeVisible()
})
