import crypto from "node:crypto";
import { seedDemoData } from "@/lib/demo-seed";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// Nightly reset of the public demo. Vercel Cron calls this with
// `Authorization: Bearer $CRON_SECRET` (schedule in vercel.json).
export const maxDuration = 60;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(req: Request) {
  if (!env.DEMO_MODE) return Response.json({ error: "Not found" }, { status: 404 });
  const authorized = env.CRON_SECRET && safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env.CRON_SECRET}`);
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const counts = await seedDemoData(prisma);
  return Response.json({ ok: true, ...counts, resetAt: new Date().toISOString() });
}
