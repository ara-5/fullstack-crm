import type { Contact, Deal } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { interpolate, matches, type EventPayload } from "./automation-rules";

const deal = { id: "d1", title: "Acme — Pilot", value: 12000, contactId: "c1", ownerId: "u1" } as Deal;
const contact = { id: "c1", firstName: "Ada", lastName: "Lovelace", status: "PROSPECT" } as Contact;
const payload: EventPayload = { actorId: "u1", deal, contact, fromStage: "PROPOSAL", toStage: "WON" };

describe("matches", () => {
  it("matches when there are no conditions", () => {
    expect(matches({}, payload)).toBe(true);
  });

  it("checks the target and source stage", () => {
    expect(matches({ toStage: "WON" }, payload)).toBe(true);
    expect(matches({ toStage: "LOST" }, payload)).toBe(false);
    expect(matches({ fromStage: "PROPOSAL", toStage: "WON" }, payload)).toBe(true);
    expect(matches({ fromStage: "LEAD" }, payload)).toBe(false);
  });

  it("applies the minimum deal value", () => {
    expect(matches({ minValue: 10000 }, payload)).toBe(true);
    expect(matches({ minValue: 12000 }, payload)).toBe(true);
    expect(matches({ minValue: 12001 }, payload)).toBe(false);
  });

  it("treats a missing deal as value 0", () => {
    expect(matches({ minValue: 1 }, { actorId: "u1", contact })).toBe(false);
  });

  it("checks the contact status", () => {
    expect(matches({ contactStatus: "PROSPECT" }, payload)).toBe(true);
    expect(matches({ contactStatus: "CUSTOMER" }, payload)).toBe(false);
  });
});

describe("interpolate", () => {
  it("replaces placeholders with record values", () => {
    expect(interpolate("Hi {{contact.firstName}}, re: {{ deal.title }} ({{deal.value}})", payload)).toBe(
      "Hi Ada, re: Acme — Pilot (12000)",
    );
  });

  it("renders missing values as empty strings and ignores unknown objects", () => {
    expect(interpolate("[{{contact.phone}}] {{user.name}}", payload)).toBe("[] {{user.name}}");
  });
});
