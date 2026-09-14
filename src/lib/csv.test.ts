import { describe, expect, it } from "vitest";
import { normalizeHeader, safeCell, splitFullName } from "./csv";

describe("normalizeHeader", () => {
  it.each([
    ["First Name", "firstName"],
    ["first_name", "firstName"],
    ["E-mail Address", "email"],
    ["Company Name", "company"],
    ["Job Title", "title"],
    ["Website", "domain"],
    ["﻿Email", "email"], // UTF-8 BOM from Excel exports
  ])("%s -> %s", (header, expected) => {
    expect(normalizeHeader(header)).toBe(expected);
  });

  it("passes unknown headers through in normalized form", () => {
    expect(normalizeHeader("Industry")).toBe("industry");
  });
});

describe("splitFullName", () => {
  it("splits on the first space and keeps multi-part last names", () => {
    expect(splitFullName("  Ada   King Lovelace ")).toEqual({ firstName: "Ada", lastName: "King Lovelace" });
    expect(splitFullName("Cher")).toEqual({ firstName: "Cher", lastName: "" });
  });
});

describe("safeCell", () => {
  it("escapes values that spreadsheets would execute as formulas", () => {
    expect(safeCell("=HYPERLINK(\"http://evil\")")).toBe("'=HYPERLINK(\"http://evil\")");
    expect(safeCell("+1 555")).toBe("'+1 555");
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("formats dates and empty values", () => {
    expect(safeCell(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
    expect(safeCell(null)).toBe("");
    expect(safeCell("Acme")).toBe("Acme");
    expect(safeCell(42)).toBe("42");
  });
});
