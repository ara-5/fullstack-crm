import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("command palette searches records and navigates", async ({ page }) => {
  await login(page);
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Search" });
  await expect(input).toBeVisible();

  await input.fill("northwind");
  const company = page.getByRole("group", { name: "Companies" }).getByRole("option").first();
  await expect(company).toContainText("Northwind Traders");
  await company.click();
  await expect(page).toHaveURL(/\/companies\//);
  await expect(page.getByRole("heading", { name: "Northwind Traders" })).toBeVisible();
});

test("command palette jumps to pages with the keyboard", async ({ page }) => {
  await login(page);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search" }).fill("reports");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/reports/);
});

test("dark mode toggle persists across reloads", async ({ page }) => {
  await login(page);
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  const toggle = page.getByRole("button", { name: /^Theme:/ });
  await toggle.click(); // system -> light
  await toggle.click(); // light -> dark
  await expect(html).toHaveClass(/dark/);

  await page.reload();
  await expect(html).toHaveClass(/dark/);
});
