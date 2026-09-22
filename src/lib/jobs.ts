import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * A Postgres-backed job outbox: durable, retryable background work that
 * survives a crash or redeploy mid-attempt, unlike firing work inline in the
 * request (see src/lib/webhooks.ts's history). No new infra service — a row
 * insert to enqueue, `FOR UPDATE SKIP LOCKED` to claim safely across however
 * many workers are running (the docker-compose `worker` service, or Vercel
 * Cron hitting /api/cron/process-jobs — see that route for which applies).
 */

export type JobType = "webhook_delivery" | "embed_record";

type HandlerCtx = { attempt: number; maxAttempts: number };
type Handler = (payload: unknown, ctx: HandlerCtx) => Promise<void>;

/** Throw this from a handler to request a retry with backoff instead of failing outright. */
export class RetryableJobError extends Error {}

const handlers = new Map<JobType, Handler>();

/** Registers what to do for a job type. Call once per type at module load. */
export function registerJobHandler(type: JobType, handler: Handler) {
  handlers.set(type, handler);
}

export async function enqueueJob(type: JobType, payload: unknown, opts: { runAt?: Date; maxAttempts?: number } = {}) {
  await prisma.job.create({
    data: {
      type,
      payload: payload as object,
      runAt: opts.runAt ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 5,
    },
  });
}

function backoffMs(attempts: number) {
  // 5s, 20s, 80s, 320s, ... capped at 30 min.
  return Math.min(5000 * 4 ** (attempts - 1), 30 * 60 * 1000);
}

async function claimBatch(limit: number) {
  // Atomic claim: only rows still PENDING/due are picked up, and the row lock
  // (SKIP LOCKED) means concurrent workers never grab the same job twice.
  return prisma.$queryRaw<{ id: string; type: string; payload: unknown; attempts: number; maxAttempts: number }[]>`
    UPDATE "Job" SET status = 'RUNNING', "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE status = 'PENDING' AND "runAt" <= NOW()
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts, "maxAttempts" AS "maxAttempts"`;
}

/**
 * Claims and runs up to `limit` due jobs. Safe to call concurrently (from
 * multiple workers, or overlapping cron ticks) and safe to call repeatedly
 * (a no-op when nothing is due). Returns how many jobs it processed.
 */
export async function processJobs(limit = 20): Promise<number> {
  const batch = await claimBatch(limit);
  await Promise.all(batch.map(runOne));
  return batch.length;
}

/** Queue health for the admin "Background jobs" panel. */
export async function jobQueueSummary() {
  const [byTypeStatus, recentFailures] = await Promise.all([
    prisma.job.groupBy({ by: ["type", "status"], _count: { _all: true } }),
    prisma.job.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);
  return { byTypeStatus, recentFailures };
}

async function runOne(job: { id: string; type: string; payload: unknown; attempts: number; maxAttempts: number }) {
  const handler = handlers.get(job.type as JobType);
  const attempts = job.attempts + 1;
  try {
    if (!handler) throw new Error(`No handler registered for job type "${job.type}"`);
    await handler(job.payload, { attempt: attempts, maxAttempts: job.maxAttempts });
    await prisma.job.update({ where: { id: job.id }, data: { status: "DONE", attempts, lastError: null } });
  } catch (err) {
    const retryable = err instanceof RetryableJobError;
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = attempts >= job.maxAttempts;
    if (retryable && !exhausted) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "PENDING", attempts, lastError: message, runAt: new Date(Date.now() + backoffMs(attempts)) },
      });
    } else {
      await prisma.job.update({ where: { id: job.id }, data: { status: "FAILED", attempts, lastError: message } });
      if (!retryable) console.error(`[jobs] "${job.type}" (${job.id}) failed non-retryably:`, err);
    }
  }
}
