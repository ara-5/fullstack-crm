import "server-only";
import { prisma } from "@/lib/prisma";

export type RateLimitResult = { ok: boolean; count: number; remaining: number; resetAt: Date };

/**
 * Fixed-window rate limiter stored in Postgres, so limits hold across
 * serverless instances. The upsert is a single atomic statement.
 */
export async function hit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  const [row] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, NOW() + (${seconds} * INTERVAL '1 second'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW()
        THEN NOW() + (${seconds} * INTERVAL '1 second')
        ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  return { ok: row.count <= limit, count: row.count, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

/** Read-only check: is this key already over its limit in the current window? */
export async function isLimited(key: string, limit: number) {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  return Boolean(row && row.resetAt > new Date() && row.count >= limit);
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export function retryAfterSeconds(resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
}
