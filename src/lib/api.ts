import "server-only";
import { apiError, authenticateApiRequest } from "@/lib/api-auth";
import type { Actor } from "@/lib/crm";
import { CrmError, errorToResponse } from "@/lib/errors";
import { hit, retryAfterSeconds } from "@/lib/rate-limit";

const API_LIMIT = 300; // requests per key owner per minute
const API_WINDOW_MS = 60_000;

/** Wraps a REST handler with API-key auth, rate limiting and uniform error responses. */
export async function withApi(req: Request, handler: (actor: Actor) => Promise<Response>) {
  const actor = await authenticateApiRequest(req);
  if (!actor) return apiError(401, "Missing or invalid API key. Send `Authorization: Bearer crm_...`.");

  const limit = await hit(`api:${actor.id}`, API_LIMIT, API_WINDOW_MS);
  if (!limit.ok) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds(limit.resetAt)) } },
    );
  }

  let res: Response;
  try {
    res = await handler(actor);
  } catch (err) {
    res = errorToResponse(err);
  }
  res.headers.set("X-RateLimit-Limit", String(API_LIMIT));
  res.headers.set("X-RateLimit-Remaining", String(limit.remaining));
  return res;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new CrmError(400, "Request body must be valid JSON");
  }
}

export function listOptions(req: Request) {
  const sp = new URL(req.url).searchParams;
  return {
    params: sp,
    q: sp.get("q") ?? undefined,
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize")) || 25,
  };
}

export const noContent = () => new Response(null, { status: 204 });
