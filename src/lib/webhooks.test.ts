import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { signPayload } from "./webhooks";

describe("signPayload", () => {
  it("matches a manually computed HMAC-SHA256 signature", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ id: "evt_1", event: "deal.created" });
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(signPayload(secret, body)).toBe(expected);
  });

  it("changes when the secret changes", () => {
    const body = "{}";
    expect(signPayload("secret-a", body)).not.toBe(signPayload("secret-b", body));
  });

  it("changes when the body changes", () => {
    const secret = "whsec_test";
    expect(signPayload(secret, '{"a":1}')).not.toBe(signPayload(secret, '{"a":2}'));
  });
});
