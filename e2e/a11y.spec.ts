import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

async function seriousViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.nodes.length}): ${v.help} → ${v.nodes[0]?.target.join(" ")}`);
}

test("login page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login");
  expect(await seriousViolations(page)).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme });

    for (const path of ["/dashboard", "/contacts", "/deals", "/tasks", "/reports", "/settings"]) {
      test(`${path} has no serious accessibility violations`, async ({ page }) => {
        await login(page);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  });
}
