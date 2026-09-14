import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("reps cannot open admin pages or manage the team", async ({ page }) => {
  await login(page, "rep@crm.local");

  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Automations" })).toHaveCount(0);
  await page.goto("/automations");
  await expect(page).toHaveURL(/\/dashboard\?denied=1/);
  // Next.js's route announcer also carries role="alert" (empty), so filter to real content.
  await expect(page.getByRole("alert").filter({ hasText: "access" })).toContainText("have access");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Your API keys" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Team members" })).toHaveCount(0);
});

test("reps only see their own contacts", async ({ page }) => {
  await login(page, "manager@crm.local");
  await page.goto("/contacts");
  const managerCount = Number((await page.getByText(/^\d+ contacts?$/).innerText()).split(" ")[0]);

  await page.getByRole("button", { name: "Sign out" }).click();
  await login(page, "rep@crm.local");
  await page.goto("/contacts");
  const repCount = Number((await page.getByText(/^\d+ contacts?$/).innerText()).split(" ")[0]);

  expect(repCount).toBeGreaterThan(0);
  expect(repCount).toBeLessThan(managerCount);
});
