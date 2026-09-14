import { describe, expect, it } from "vitest";
import { diffRecords } from "./diff";

describe("diffRecords", () => {
  it("returns only changed fields with before and after values", () => {
    const before = { title: "Pilot", value: 1000, stage: "LEAD", ownerId: "u1" };
    const after = { title: "Pilot", value: 2500, stage: "WON", ownerId: "u1" };
    expect(diffRecords(before, after)).toEqual({
      value: { from: 1000, to: 2500 },
      stage: { from: "LEAD", to: "WON" },
    });
  });

  it("compares dates by value and treats undefined as null", () => {
    const date = new Date("2026-09-01T00:00:00.000Z");
    expect(diffRecords({ closedAt: date, email: undefined }, { closedAt: new Date(date), email: null })).toEqual({});
    expect(diffRecords({ closedAt: null }, { closedAt: date })).toEqual({
      closedAt: { from: null, to: "2026-09-01T00:00:00.000Z" },
    });
  });

  it("ignores bookkeeping fields", () => {
    expect(diffRecords({ id: "1", updatedAt: new Date(0) }, { id: "2", updatedAt: new Date() })).toEqual({});
  });
});
