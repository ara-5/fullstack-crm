import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * One row per call to an AI provider (Claude or Voyage), so "does the AI
 * assistant actually work well" is a query instead of a guess: call volume,
 * latency, error rate, and — for the agent — whether proposed actions get
 * approved or rejected (see AgentProposal). No fabricated dollar costs here;
 * only real numbers the API actually returns (tokens, latency).
 */

export type AiFeature = "deal_insights" | "agent_command" | "embedding";
export type AiCallStatus = "ok" | "error" | "refused";

type LogEntry = {
  feature: AiFeature;
  userId?: string | null;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs: number;
  status: AiCallStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logAiCall(entry: LogEntry) {
  try {
    await prisma.aiCallLog.create({
      data: {
        feature: entry.feature,
        userId: entry.userId ?? null,
        model: entry.model,
        inputTokens: entry.inputTokens ?? null,
        outputTokens: entry.outputTokens ?? null,
        latencyMs: entry.latencyMs,
        status: entry.status,
        errorMessage: entry.errorMessage ?? null,
        metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Observability must never take down the feature it's observing.
    console.error("[ai-log] failed to record AI call:", err);
  }
}

type Usage = { inputTokens?: number; outputTokens?: number };

/** Times an AI call and logs its outcome (including on failure), then rethrows. */
export async function withAiLog<T>(
  entry: { feature: AiFeature; userId?: string | null; model: string; metadata?: Record<string, unknown> },
  fn: () => Promise<{ result: T; usage?: Usage; refused?: boolean }>,
): Promise<T> {
  const start = Date.now();
  try {
    const { result, usage, refused } = await fn();
    await logAiCall({
      ...entry,
      latencyMs: Date.now() - start,
      status: refused ? "refused" : "ok",
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
    });
    return result;
  } catch (err) {
    await logAiCall({
      ...entry,
      latencyMs: Date.now() - start,
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function aiUsageSummary(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [totals, byFeature, recent, pendingProposals] = await Promise.all([
    prisma.aiCallLog.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { latencyMs: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.aiCallLog.groupBy({ by: ["feature", "status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.aiCallLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { name: true } } },
    }),
    prisma.agentProposal.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  return { since, totals, byFeature, recent, pendingProposals };
}
