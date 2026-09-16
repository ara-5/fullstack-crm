import { expect, test } from "@playwright/test";
import { totp } from "../src/lib/totp";
import { login, PASSWORD } from "./helpers";

test("saved views remember a filter and reapply it", async ({ page }) => {
  await login(page, "manager@crm.local");
  await page.goto("/contacts?status=CUSTOMER");

  await page.getByPlaceholder("Save this view as…").fill("Customers e2e");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("View saved.")).toBeVisible();

  const pill = page.getByRole("link", { name: "Customers e2e" });
  await expect(pill).toBeVisible();

  // Clear the filter, then use the saved view to bring it back.
  await page.goto("/contacts");
  await expect(page.locator("select[name=status]")).toHaveValue("");
  await page.getByRole("link", { name: "Customers e2e" }).click();
  await expect(page).toHaveURL(/status=CUSTOMER/);
  await expect(page.locator("select[name=status]")).toHaveValue("CUSTOMER");

  // Clean up so repeat runs stay idempotent.
  await page.getByRole("button", { name: 'Delete view "Customers e2e"' }).click();
  await expect(page.getByRole("link", { name: "Customers e2e" })).toHaveCount(0);
});

test("bulk-selecting contacts can tag and delete them", async ({ page }) => {
  await login(page, "manager@crm.local");

  for (const name of ["Bulk One", "Bulk Two"]) {
    await page.goto("/contacts/new");
    const [first, last] = name.split(" ");
    await page.getByLabel("First name").fill(first);
    await page.getByLabel("Last name").fill(last);
    await page.getByRole("button", { name: "Create contact" }).click();
    await expect(page).toHaveURL(/\/contacts\/c/);
  }

  await page.goto("/contacts?q=Bulk");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByRole("checkbox").check();
  await rows.nth(1).getByRole("checkbox").check();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByPlaceholder("Add tag…").fill("e2e-bulk");
  await page.getByRole("button", { name: "Tag" }).click();
  await expect(page.getByText("2 selected")).toHaveCount(0);

  await page.getByRole("link", { name: "Bulk One" }).click();
  await expect(page.getByLabel("Tags")).toHaveValue("e2e-bulk");

  await page.goto("/contacts?q=Bulk");
  await page.locator("tbody tr").nth(0).getByRole("checkbox").check();
  await page.locator("tbody tr").nth(1).getByRole("checkbox").check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(/No contacts match|0 contacts/)).toBeVisible();
});

test("reassigning a record notifies its new owner", async ({ browser }) => {
  const managerCtx = await browser.newContext();
  const managerPage = await managerCtx.newPage();
  await login(managerPage, "manager@crm.local");

  await managerPage.goto("/contacts/new");
  await managerPage.getByLabel("First name").fill("Notify");
  await managerPage.getByLabel("Last name").fill("Target");
  await managerPage.getByRole("button", { name: "Create contact" }).click();
  await expect(managerPage).toHaveURL(/\/contacts\/c/);

  await managerPage.getByLabel("Owner").selectOption({ label: "Riley Rep" });
  await managerPage.getByRole("button", { name: "Save changes" }).click();
  await expect(managerPage.getByText("Changes saved.")).toBeVisible();
  await managerCtx.close();

  const repCtx = await browser.newContext();
  const repPage = await repCtx.newPage();
  await login(repPage, "rep@crm.local");

  const bell = repPage.getByRole("button", { name: /Notifications/ });
  await expect(bell).toContainText(/[1-9]/);
  await bell.click();
  const item = repPage.getByRole("menuitem", { name: /You were assigned Notify Target/ });
  await expect(item).toBeVisible();
  await item.click();
  await expect(repPage).toHaveURL(/\/contacts\/c/);
  await expect(repPage.getByRole("heading", { name: /Notify Target/ })).toBeVisible();
  await repCtx.close();
});

test("presence shows another viewer on the same record", async ({ browser }) => {
  test.setTimeout(45_000);
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const a = await aCtx.newPage();
  const b = await bCtx.newPage();
  await login(a, "manager@crm.local");
  await login(b, "admin@crm.local");

  await a.goto("/contacts?q=Northwind");
  await a.getByRole("link", { name: "Northwind Traders" }).first().click();
  const recordUrl = a.url();
  await b.goto(recordUrl);

  // B's first heartbeat sees A immediately; A only sees B on its next ~10s tick.
  await expect(b.getByText(/is also viewing this/)).toBeVisible({ timeout: 15_000 });
  await expect(a.getByText(/is also viewing this/)).toBeVisible({ timeout: 20_000 });

  await aCtx.close();
  await bCtx.close();
});

test("two-factor authentication can be enabled, required at login, and disabled", async ({ page }) => {
  await login(page, "sam@crm.local");
  await page.goto("/settings");

  await page.getByRole("button", { name: "Enable 2FA" }).click();
  const manualKey = await page.getByText(/^[A-Z2-7]{32}$/).innerText();

  await page.getByLabel("Enter the 6-digit code").fill(totp(manualKey));
  await page.getByRole("button", { name: "Confirm and enable" }).click();
  await expect(page.getByText("Two-factor authentication is on.")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill("sam@crm.local");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  const codeField = page.getByLabel("Authentication code");
  await expect(codeField).toBeVisible();
  await codeField.fill(totp(manualKey));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Clean up so other runs (and other specs) can log in as sam@crm.local without a code.
  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Disable 2FA" }).click();
  await expect(page.getByRole("button", { name: "Enable 2FA" })).toBeVisible();
});
