import type { NextRequest } from "next/server";
import { listOptions, readJson, withApi } from "@/lib/api";
import { createDeal, listDeals } from "@/lib/crm";

export function GET(req: NextRequest) {
  return withApi(req, async (actor) => {
    const { q, params } = listOptions(req);
    const items = await listDeals(actor, { q, stage: params.get("stage") ?? undefined });
    return Response.json({ items, total: items.length });
  });
}

export function POST(req: NextRequest) {
  return withApi(req, async (actor) =>
    Response.json(await createDeal(actor, await readJson(req)), { status: 201 }),
  );
}
