import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/constants";

export function hashApiKey(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey() {
  const raw = "crm_" + crypto.randomBytes(24).toString("base64url");
  return { raw, prefix: raw.slice(0, 12), hash: hashApiKey(raw) };
}

/** Resolves `Authorization: Bearer crm_...` to the key's owner, or null. */
export async function authenticateApiRequest(req: Request) {
  const match = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(crm_[\w-]+)$/);
  if (!match) return null;

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(match[1]) },
    include: { user: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });
  if (!key || !key.user.active) return null;

  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { ...key.user, role: key.user.role as Role };
}

export function apiError(status: number, message: string, details?: unknown) {
  return Response.json({ error: message, ...(details ? { details } : {}) }, { status });
}
