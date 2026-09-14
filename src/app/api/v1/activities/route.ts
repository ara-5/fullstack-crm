import type { NextRequest } from "next/server";
import { listOptions, readJson, withApi } from "@/lib/api";
import { ACTIVITY_VIEWS, createActivity, listActivities } from "@/lib/crm";

export function GET(req: NextRequest) {
  return withApi(req, async (actor) => {
    const { params } = listOptions(req);
    const view = ACTIVITY_VIEWS.find((v) => v === params.get("view")) ?? "open";
    const items = await listActivities(actor, { view, mine: params.get("mine") === "true" });
    return Response.json({ items, total: items.length });
  });
}

export function POST(req: NextRequest) {
  return withApi(req, async (actor) =>
    Response.json(await createActivity(actor, await readJson(req)), { status: 201 }),
  );
}
