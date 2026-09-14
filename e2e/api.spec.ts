import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("REST API: create a key in settings and use it", async ({ page, request }) => {
  await login(page);
  await page.goto("/settings");
  await page.getByLabel("New key name").fill("e2e");
  await page.getByRole("button", { name: "Create key" }).click();
  const key = (await page.locator("code").filter({ hasText: /^crm_[\w-]{20,}$/ }).innerText()).trim();

  expect((await request.get("/api/v1/contacts")).status()).toBe(401);

  const headers = { Authorization: `Bearer ${key}` };
  const list = await request.get("/api/v1/contacts?pageSize=5", { headers });
  expect(list.status()).toBe(200);
  expect(list.headers()["x-ratelimit-limit"]).toBe("300");
  expect((await list.json()).items).toHaveLength(5);

  const invalid = await request.post("/api/v1/contacts", { headers, data: { email: "nope" } });
  expect(invalid.status()).toBe(422);

  const created = await request.post("/api/v1/contacts", {
    headers,
    data: { firstName: "Api", lastName: "User", email: "api.user@example.com" },
  });
  expect(created.status()).toBe(201);
  const contact = await created.json();

  const patched = await request.patch(`/api/v1/contacts/${contact.id}`, { headers, data: { title: "Integrator" } });
  expect(await patched.json()).toMatchObject({ title: "Integrator", email: "api.user@example.com", status: "LEAD" });
});

test("publishes an OpenAPI 3.1 description and interactive docs", async ({ request, page }) => {
  const spec = await request.get("/api/v1/openapi.json");
  expect(spec.status()).toBe(200);
  const json = await spec.json();
  expect(json.openapi).toBe("3.1.0");
  expect(Object.keys(json.paths)).toContain("/api/v1/deals/{id}");
  expect(json.paths["/api/v1/contacts"].post.requestBody.content["application/json"].schema.required).toContain("firstName");

  const docs = await page.goto("/api-docs");
  expect(docs?.status()).toBe(200);
});
