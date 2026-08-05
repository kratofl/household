import { expect, test } from "@playwright/test"

import { pickOption, seedSession } from "./helpers"

// Journey: non-monthly commitment with gradual reservation in English
// (stories 32-44).
test("gradual reservation commitment appears in planning in English", async ({ page }) => {
  await seedSession(page, "en")
  await page.goto("/budget/planning")

  const commitmentCard = page
    .locator("div.rounded-lg.border")
    .filter({ has: page.getByRole("heading", { name: "Fixed costs and subscriptions" }) })
  await commitmentCard.getByPlaceholder("Commitment name").fill("Insurance E2E")
  await commitmentCard.getByPlaceholder("Amount").first().fill("120")
  await pickOption(commitmentCard.getByLabel("Category", { exact: true }).first(), "Fixkosten")
  await pickOption(commitmentCard.locator("select").filter({ hasText: "monthly" }).first(), "yearly")
  await pickOption(commitmentCard.getByLabel("Budgeting mode"), "Reserve gradually")
  await commitmentCard.getByLabel("Start date").fill("2026-12-01")
  await commitmentCard.getByRole("button", { name: "Add commitment" }).click()

  await expect(commitmentCard.locator("p", { hasText: "Insurance E2E" }).first()).toBeVisible()
  await expect(commitmentCard.getByRole("heading", { name: "Expected commitments" })).toBeVisible()

  await page.goto("/budget")
  await expect(page.getByText("Reserved for commitments")).toBeVisible()
})
