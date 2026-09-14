import { test } from "@playwright/test";
import { login } from "./helpers";

// Generates the README screenshots: `npm run screenshots`.
const OUT = "docs/screenshots";

test.use({ viewport: { width: 1440, height: 900 } });

for (const theme of ["light", "dark"] as const) {
  test(`capture ${theme} screenshots`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    await login(page, "manager@crm.local");

    const shots: [string, string][] = [
      ["dashboard", "/dashboard"],
      ["pipeline", "/deals"],
      ["reports", "/reports"],
      ["automations", "/automations"],
    ];
    for (const [name, path] of shots) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600); // let charts finish animating
      await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
    }

    await page.goto("/deals");
    await page.getByRole("region", { name: "Proposal stage" }).getByRole("link").first().click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${OUT}/deal-${theme}.png` });

    await page.goto("/dashboard");
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search" }).fill("glo");
    await page.getByRole("group", { name: "Companies" }).waitFor();
    await page.screenshot({ path: `${OUT}/command-palette-${theme}.png` });
  });
}

test("capture mobile screenshot", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await login(page, "manager@crm.local");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/mobile-dashboard.png` });
  await context.close();
});
