import crypto from "node:crypto";
import "@/lib/job-handlers";
import { env } from "@/lib/env";
import { processJobs } from "@/lib/jobs";

// Drains the Job outbox (webhook delivery, embeddings, ...) for deployments
// with no long-running process to host scripts/worker.ts's loop — e.g.
// Vercel Cron (see vercel.json). Self-hosted/Docker deployments run the
// `worker` compose service instead, which processes jobs continuously rather
// than once per cron tick.
export const maxDuration = 60;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(req: Request) {
  const authorized = env.CRON_SECRET && safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env.CRON_SECRET}`);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let total = 0;
  const deadline = Date.now() + 50_000; // stay under maxDuration
  for (;;) {
    const processed = await processJobs(20);
    total += processed;
    if (processed === 0 || Date.now() >= deadline) break;
  }
  return Response.json({ ok: true, processed: total });
}
