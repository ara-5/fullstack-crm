import type { NextRequest } from "next/server";
import { noContent, readJson, withApi } from "@/lib/api";
import { apiError } from "@/lib/api-auth";
import { deleteDeal, getDeal, updateDeal } from "@/lib/crm";

type Ctx = RouteContext<"/api/v1/deals/[id]">;

export function GET(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    const deal = await getDeal(actor, (await ctx.params).id);
    return deal ? Response.json(deal) : apiError(404, "Deal not found");
  });
}

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) =>
    Response.json(await updateDeal(actor, (await ctx.params).id, await readJson(req))),
  );
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    await deleteDeal(actor, (await ctx.params).id);
    return noContent();
  });
}
