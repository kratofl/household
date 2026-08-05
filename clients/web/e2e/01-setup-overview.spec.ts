import { expect, test } from "@playwright/test"

import { adminUser } from "./stack"

// Journey: first login and functional Budget setup in German, ending on a usable
// current-period overview instead of an empty dashboard (stories 5-11).
test("first-run setup leads to a usable German overview", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("household.locale", "de"))
  await page.goto("/")

  await page.getByLabel("Username").fill(adminUser.username)
  await page.getByLabel("Passwort").fill(adminUser.password)
  await page.getByRole("button", { name: "Anmelden" }).focus()
  await page.keyboard.press("Enter")

  await page.getByRole("link", { name: "Uebersicht" }).click()
  await expect(page.getByText("Budget einrichten")).toBeVisible()
  await expect(page.getByLabel("Basiswaehrung")).toHaveValue("EUR")
  await page.getByLabel("Starttag der Budget-Periode").fill("1")
  await page.getByLabel("Pufferbetrag").fill("100")
  await page.getByRole("button", { name: "Budget starten" }).click()

  await expect(page.getByRole("heading", { name: "Erinnerungen" })).toBeVisible()
  await expect(page.getByText("Erhaltenes Einkommen")).toBeVisible()
  await expect(page.getByText("Maximal verfuegbar")).toBeVisible()
  await expect(page.getByText("Geschuetzter Puffer").first()).toBeVisible()
})
