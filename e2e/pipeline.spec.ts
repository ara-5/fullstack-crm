import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Wide enough to show all six stage columns without horizontal scrolling.
test.use({ viewport: { width: 2200, height: 1100 } });

test("dragging a deal to an adjacent stage persists after reload", async ({ page }) => {
  await login(page, "manager@crm.local");
  await page.goto("/deals");

  const leadColumn = page.getByRole("region", { name: "Lead stage" });
  const qualifiedColumn = page.getByRole("region", { name: "Qualified stage" });
  const card = leadColumn.locator("article").first();
  const title = (await card.getByRole("link").innerText()).trim();

  const from = (await card.boundingBox())!;
  const to = (await qualifiedColumn.boundingBox())!;
  const startX = from.x + from.width / 2;
  const startY = from.y + 12;
  const endX = to.x + to.width / 2;
  const endY = to.y + 80;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(100); // let dnd-kit's pointer sensor register mousedown
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + ((endX - startX) * i) / steps, startY + ((endY - startY) * i) / steps);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(150); // let dnd-kit register the hover-over-droppable before releasing
  await page.mouse.up();

  await expect(qualifiedColumn.getByRole("link", { name: title })).toBeVisible();

  // The move is persisted, not just optimistic.
  await page.reload();
  await expect(page.getByRole("region", { name: "Qualified stage" }).getByRole("link", { name: title })).toBeVisible();
});

test("moving a deal to Won runs the onboarding automation", async ({ page }) => {
  await login(page, "manager@crm.local");
  await page.goto("/deals");

  const openDeal = page
    .getByRole("region", { name: "Proposal stage" })
    .locator("article")
    .first();
  const title = (await openDeal.getByRole("link").innerText()).trim();
  await openDeal.getByRole("link").click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("navigation", { name: "Deal stage" }).getByRole("button", { name: "Won" }).click();

  // The "Deal won → onboarding kickoff task" automation created a task, and the
  // stage change itself is recorded in the audit history.
  await expect(page.getByText(`Kick off onboarding for ${title}`)).toBeVisible();
  await expect(page.getByText("moved the stage: Lead → Won").or(page.getByText(/moved the stage: .+ → Won/))).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Deal stage" }).getByRole("button", { name: "Won" })).toHaveAttribute(
    "aria-current",
    "step",
  );
});

test("open deals show an explainable health score", async ({ page }) => {
  await login(page, "manager@crm.local");
  await page.goto("/deals");
  await expect(page.getByText(/^(Healthy|Needs attention|At risk) · \d+$/).first()).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Deals needing attention" })).toBeVisible();
});
