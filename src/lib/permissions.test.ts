import { describe, expect, it } from "vitest";
import { can, ownerScope } from "./permissions";

const admin = { id: "a", role: "ADMIN" as const };
const manager = { id: "m", role: "MANAGER" as const };
const rep = { id: "r", role: "REP" as const };

describe("ownerScope", () => {
  it("lets admins and managers see every record", () => {
    expect(ownerScope(admin)).toEqual({});
    expect(ownerScope(manager)).toEqual({});
  });

  it("limits reps to records they own", () => {
    expect(ownerScope(rep)).toEqual({ ownerId: "r" });
  });
});

describe("can", () => {
  it("reserves user and webhook management for admins", () => {
    expect([admin, manager, rep].map(can.manageUsers)).toEqual([true, false, false]);
    expect([admin, manager, rep].map(can.manageWebhooks)).toEqual([true, false, false]);
  });

  it("gives managers automations, import/export, deletes and reassignment", () => {
    for (const check of [can.manageAutomations, can.importData, can.exportData, can.deleteRecords, can.reassignOwner]) {
      expect([admin, manager, rep].map(check)).toEqual([true, true, false]);
    }
  });
});
