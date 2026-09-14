import type { NextRequest } from "next/server";
import { noContent, readJson, withApi } from "@/lib/api";
import { deleteActivity, updateActivity } from "@/lib/crm";

type Ctx = RouteContext<"/api/v1/activities/[id]">;

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) =>
    Response.json(await updateActivity(actor, (await ctx.params).id, await readJson(req))),
  );
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    await deleteActivity(actor, (await ctx.params).id);
    return noContent();
  });
}
