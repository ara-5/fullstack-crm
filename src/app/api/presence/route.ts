import { heartbeat, listViewers } from "@/lib/presence";
import { getCurrentUser } from "@/lib/session";

const ENTITY_TYPES = new Set(["contact", "company", "deal"]);

// Called every few seconds by a record detail page while it's open: records that
// this user is looking at it, and returns who else currently is.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const entityType = typeof body?.entityType === "string" ? body.entityType : "";
  const entityId = typeof body?.entityId === "string" ? body.entityId : "";
  if (!ENTITY_TYPES.has(entityType) || !entityId) return Response.json({ error: "Invalid entity" }, { status: 422 });

  await heartbeat(user.id, entityType, entityId);
  const viewers = await listViewers(entityType, entityId, user.id);
  return Response.json({ viewers }, { headers: { "Cache-Control": "no-store" } });
}
