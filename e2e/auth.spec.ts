import { expect, test } from "@playwright/test";
import { login, PASSWORD } from "./helpers";

test("redirects signed-out visitors to the login page", async ({ page }) => {
  await page.goto("/deals");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdeals/);
});

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("manager@crm.local");
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Next.js's route announcer also carries role="alert" (empty), so filter to real content.
  await expect(page.getByRole("alert").filter({ hasText: "Invalid" })).toContainText("Invalid email or password");
  await expect(page).toHaveURL(/\/login/);
});

test("returns to the requested page after signing in", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByLabel("Email").fill("admin@crm.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks/);
  await expect(page.getByRole("heading", { name: "Tasks & activities" })).toBeVisible();
});

test("signs in and out", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
