import "server-only";
import { apiError, authenticateApiRequest } from "@/lib/api-auth";
import { CrmError, errorToResponse } from "@/lib/errors";
import type { Actor } from "@/lib/crm";

/** Wraps a REST handler with API-key auth and uniform error responses. */
export async function withApi(req: Request, handler: (actor: Actor) => Promise<Response>) {
  const actor = await authenticateApiRequest(req);
  if (!actor) return apiError(401, "Missing or invalid API key. Send `Authorization: Bearer crm_...`.");
  try {
    return await handler(actor);
  } catch (err) {
    return errorToResponse(err);
  }
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
