import { describe, expect, it } from "vitest";
import { contactInput, contactPatch, dealInput, formToObject, ruleInput, webhookInput } from "./validation";

describe("contactPatch", () => {
  it("only touches fields that were sent (no defaults leak into updates)", () => {
    const parsed = contactPatch.parse({ title: "CTO" });
    expect(parsed).toEqual({ title: "CTO" });
    expect(parsed.status).toBeUndefined();
  });

  it("maps empty strings to null so a field can be cleared", () => {
    expect(contactPatch.parse({ email: "", phone: "   " })).toEqual({ email: null, phone: null });
  });

  it("rejects an invalid email with a field-level error", () => {
    const result = contactPatch.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["email"]);
  });
});

describe("contactInput", () => {
  it("requires a first name", () => {
    expect(contactInput.safeParse({ lastName: "Lovelace" }).success).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(contactInput.safeParse({ firstName: "Ada", status: "VIP" }).success).toBe(false);
  });
});

describe("dealInput", () => {
  it("coerces form values and normalizes currency", () => {
    const parsed = dealInput.parse({ title: "Pilot", value: "1500.50", currency: "eur", stage: "PROPOSAL" });
    expect(parsed).toMatchObject({ title: "Pilot", value: 1500.5, currency: "EUR", stage: "PROPOSAL" });
  });

  it("rejects negative values and unknown stages", () => {
    expect(dealInput.safeParse({ title: "x", value: -1 }).success).toBe(false);
    expect(dealInput.safeParse({ title: "x", stage: "MAYBE" }).success).toBe(false);
  });

  it("parses expected close dates and clears them with an empty string", () => {
    expect(dealInput.parse({ title: "x", expectedClose: "2026-10-01" }).expectedClose).toBeInstanceOf(Date);
    expect(dealInput.parse({ title: "x", expectedClose: "" }).expectedClose).toBeNull();
  });
});

describe("ruleInput", () => {
  const base = { name: "Rule", trigger: "deal.stage_changed" };

  it("requires a subject for email actions", () => {
    const result = ruleInput.safeParse({ ...base, action: "SEND_EMAIL", subject: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain("subject");
  });

  it("requires a status for contact-status actions", () => {
    expect(ruleInput.safeParse({ ...base, action: "UPDATE_CONTACT_STATUS" }).success).toBe(false);
  });

  it("accepts a task rule with empty optional fields", () => {
    const parsed = ruleInput.parse({ ...base, action: "CREATE_TASK", toStage: "WON", fromStage: "", minValue: "", dueInDays: "3" });
    expect(parsed).toMatchObject({ toStage: "WON", fromStage: null, minValue: null, dueInDays: 3 });
  });
});

describe("webhookInput", () => {
  it("accepts https URLs with at least one event", () => {
    expect(webhookInput.safeParse({ url: "https://example.com/hook", events: ["deal.created"] }).success).toBe(true);
  });

  it("rejects non-http protocols and empty event lists", () => {
    expect(webhookInput.safeParse({ url: "ftp://example.com/hook", events: ["deal.created"] }).success).toBe(false);
    expect(webhookInput.safeParse({ url: "https://example.com/hook", events: [] }).success).toBe(false);
  });
});

describe("formToObject", () => {
  it("keeps string fields and drops files and Next.js action metadata", () => {
    const form = new FormData();
    form.set("firstName", "Ada");
    form.set("$ACTION_ID_abc", "");
    form.set("file", new File(["x"], "x.csv"));
    expect(formToObject(form)).toEqual({ firstName: "Ada" });
  });
});
