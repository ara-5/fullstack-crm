import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";

export async function login(page: Page, email = "admin@crm.local") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
