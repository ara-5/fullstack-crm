import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("creates a contact, logs a note, edits it and records the history", async ({ page }) => {
  await login(page);
  await page.goto("/contacts/new");
  await page.getByLabel("First name").fill("Grace");
  await page.getByLabel("Last name").fill("Hopper");
  await page.getByLabel("Email").fill("grace@example.com");
  await page.getByRole("button", { name: "Create contact" }).click();

  await expect(page).toHaveURL(/\/contacts\/c/);
  await expect(page.getByRole("heading", { name: /Grace Hopper/ })).toBeVisible();

  // Log a note on the timeline
  await page.getByLabel("Subject").fill("Intro call");
  await page.getByLabel("Details").fill("Loved the pipeline demo.");
  await page.getByRole("button", { name: "Save activity" }).click();
  await expect(page.getByText("Loved the pipeline demo.")).toBeVisible();

  // Edit a field and see it in the audit history
  await page.getByLabel("Job title").fill("Rear Admiral");
  await page.getByRole("button", { name: "Save changes" }).click();
  // Two forms on this page each show their own role="status" notice; be specific.
  await expect(page.getByText("Changes saved.")).toBeVisible();

  const history = page.locator("section", { hasText: "History" }).last();
  await expect(history).toContainText("created this record");
  await expect(history).toContainText("job title: empty → Rear Admiral");
});

test("search finds contacts case-insensitively", async ({ page }) => {
  await login(page);
  await page.goto("/contacts?q=NORTHWIND");
  await expect(page.getByRole("link", { name: "Northwind Traders" }).first()).toBeVisible();
});
