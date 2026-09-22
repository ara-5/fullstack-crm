import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

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

/**
 * The client IP is only as trustworthy as the proxy in front of us: anyone can
 * set X-Forwarded-For directly. Without TRUST_PROXY_HEADERS (the safe default
 * for a directly-exposed deployment) we don't trust it at all, so the IP-based
 * limiter simply doesn't engage — the per-account limiter still does. With it
 * set (behind exactly one reverse proxy / Vercel), we take the *last* entry,
 * i.e. the peer our proxy actually saw, since an attacker can prepend fake
 * entries to the header but can't fabricate what the proxy itself observed.
 */
export function clientIp(headers: Headers) {
  if (!env.TRUST_PROXY_HEADERS) return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return headers.get("x-real-ip") || "unknown";
}

export function retryAfterSeconds(resetAt: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
}
