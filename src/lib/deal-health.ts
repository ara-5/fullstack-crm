import { OPEN_STAGES } from "./constants";

// Explainable deal health scoring. Pure and deterministic (no AI needed), so every
// open deal gets a score plus the concrete reasons behind it.

export type HealthLevel = "healthy" | "watch" | "at_risk";
export type DealHealth = { score: number; level: HealthLevel; reasons: string[] };

export type HealthInput = {
  stage: string;
  createdAt: Date;
  expectedClose: Date | null;
  lastActivityAt: Date | null;
  overdueTasks: number;
  hasUpcomingTask: boolean;
};

const DAY = 24 * 60 * 60 * 1000;
const EARLY_STAGES = ["LEAD", "QUALIFIED"];

export function scoreDeal(input: HealthInput, now = new Date()): DealHealth | null {
  if (!(OPEN_STAGES as string[]).includes(input.stage)) return null; // won/lost deals aren't scored

  let score = 100;
  const reasons: string[] = [];
  const penalize = (points: number, reason: string) => {
    score -= points;
    reasons.push(reason);
  };

  const ageDays = (now.getTime() - input.createdAt.getTime()) / DAY;
  if (input.lastActivityAt) {
    const quietDays = Math.floor((now.getTime() - input.lastActivityAt.getTime()) / DAY);
    if (quietDays > 21) penalize(30, `No activity in ${quietDays} days`);
    else if (quietDays > 10) penalize(15, `Quiet for ${quietDays} days`);
  } else if (ageDays > 3) {
    penalize(25, "No activity logged yet");
  }

  if (input.expectedClose) {
    const daysToClose = (input.expectedClose.getTime() - now.getTime()) / DAY;
    if (daysToClose < 0) penalize(30, "Expected close date has passed");
    else if (daysToClose <= 7 && EARLY_STAGES.includes(input.stage)) penalize(15, "Closing within a week but still early-stage");
  } else {
    penalize(10, "No expected close date");
  }

  if (input.overdueTasks > 0) {
    penalize(Math.min(30, input.overdueTasks * 10), `${input.overdueTasks} overdue task${input.overdueTasks === 1 ? "" : "s"}`);
  }
  if (!input.hasUpcomingTask) penalize(10, "No next step scheduled");

  score = Math.max(0, Math.min(100, score));
  const level: HealthLevel = score >= 70 ? "healthy" : score >= 40 ? "watch" : "at_risk";
  return { score, level, reasons };
}

export const HEALTH_LABELS: Record<HealthLevel, string> = {
  healthy: "Healthy",
  watch: "Needs attention",
  at_risk: "At risk",
};
