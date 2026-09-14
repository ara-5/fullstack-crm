import { describe, expect, it } from "vitest";
import { scoreDeal, type HealthInput } from "./deal-health";

const now = new Date("2026-09-14T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => daysAgo(-n);

const healthy: HealthInput = {
  stage: "PROPOSAL",
  createdAt: daysAgo(30),
  expectedClose: daysAhead(20),
  lastActivityAt: daysAgo(2),
  overdueTasks: 0,
  hasUpcomingTask: true,
};

describe("scoreDeal", () => {
  it("does not score closed deals", () => {
    expect(scoreDeal({ ...healthy, stage: "WON" }, now)).toBeNull();
    expect(scoreDeal({ ...healthy, stage: "LOST" }, now)).toBeNull();
  });

  it("rates an active, scheduled deal as healthy with no reasons", () => {
    expect(scoreDeal(healthy, now)).toEqual({ score: 100, level: "healthy", reasons: [] });
  });

  it("flags deals that have gone quiet", () => {
    expect(scoreDeal({ ...healthy, lastActivityAt: daysAgo(14) }, now)?.reasons).toEqual(["Quiet for 14 days"]);
    expect(scoreDeal({ ...healthy, lastActivityAt: daysAgo(30) }, now)).toMatchObject({
      score: 70,
      reasons: ["No activity in 30 days"],
    });
  });

  it("gives brand-new deals a grace period before requiring activity", () => {
    expect(scoreDeal({ ...healthy, createdAt: daysAgo(1), lastActivityAt: null }, now)?.score).toBe(100);
    expect(scoreDeal({ ...healthy, createdAt: daysAgo(5), lastActivityAt: null }, now)?.reasons).toContain("No activity logged yet");
  });

  it("penalizes missed close dates and early-stage deals closing soon", () => {
    expect(scoreDeal({ ...healthy, expectedClose: daysAgo(3) }, now)?.reasons).toContain("Expected close date has passed");
    expect(scoreDeal({ ...healthy, stage: "LEAD", expectedClose: daysAhead(5) }, now)?.reasons).toContain(
      "Closing within a week but still early-stage",
    );
    expect(scoreDeal({ ...healthy, stage: "NEGOTIATION", expectedClose: daysAhead(5) }, now)?.reasons).toEqual([]);
  });

  it("caps the overdue-task penalty and marks neglected deals at risk", () => {
    const result = scoreDeal(
      { ...healthy, lastActivityAt: daysAgo(40), expectedClose: daysAgo(1), overdueTasks: 5, hasUpcomingTask: false },
      now,
    );
    expect(result).toEqual({
      score: 0,
      level: "at_risk",
      reasons: ["No activity in 40 days", "Expected close date has passed", "5 overdue tasks", "No next step scheduled"],
    });
  });

  it("uses 'watch' for the middle band", () => {
    expect(scoreDeal({ ...healthy, expectedClose: null, lastActivityAt: daysAgo(25), hasUpcomingTask: false }, now)).toMatchObject({
      score: 50,
      level: "watch",
    });
  });
});
