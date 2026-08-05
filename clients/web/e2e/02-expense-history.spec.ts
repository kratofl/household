import { expect, test } from "@playwright/test"

import { pickOption, seedSession } from "./helpers"

// Journey: manual split expense plus correction and void history in English
// (stories 50-61).
test("split expense and correction history stay auditable in English", async ({ page }) => {
  await seedSession(page, "en")
  await page.goto("/budget/transactions")
  await expect(page.getByText("New expense")).toBeVisible()

  await page.getByLabel("Description").fill("Weekly groceries E2E")
  await page.getByLabel("Merchant", { exact: true }).fill("REWE")
  await page.getByLabel("Amount", { exact: true }).fill("100")
  await pickOption(page.getByLabel("Category", { exact: true }).first(), "Lebensmittel")
  await page.getByLabel("Split across categories").click()
  await page.locator('label:has-text("First split amount") + input').fill("40")
  await pickOption(page.locator('label:has-text("Category for the remainder") + select'), "Flexibel")
  await page.getByRole("button", { name: "Save expense" }).click()
  await expect(page.locator("p", { hasText: "Weekly groceries E2E" }).first()).toBeVisible()

  await page.getByLabel("Split across categories").click()
  await page.getByLabel("Description").fill("Office chair E2E")
  await page.getByLabel("Amount", { exact: true }).fill("80")
  await page.getByRole("button", { name: "Save expense" }).click()
  await page.getByRole("button").filter({ hasText: "Office chair E2E" }).first().click()
  await page.getByRole("button", { name: "Correct", exact: true }).click()
  await page.getByPlaceholder("Reason").fill("Receipt showed a different total")
  await page.getByPlaceholder("Amount", { exact: true }).fill("90")
  await page.getByRole("button", { name: "Confirm action" }).click()
  await expect(page.locator("p", { hasText: "corrected" }).first()).toBeVisible()

  await page.getByLabel("Description").fill("Duplicate entry E2E")
  await page.getByLabel("Amount", { exact: true }).fill("5")
  await page.getByRole("button", { name: "Save expense" }).click()
  await page.getByRole("button").filter({ hasText: "Duplicate entry E2E" }).first().click()
  await page.getByRole("button", { name: "Void", exact: true }).click()
  await page.getByPlaceholder("Reason").fill("Duplicate import")
  await page.getByRole("button", { name: "Confirm action" }).click()
  await expect(page.locator("p", { hasText: "voided" }).first()).toBeVisible()
})
