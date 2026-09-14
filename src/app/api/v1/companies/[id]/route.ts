import type { NextRequest } from "next/server";
import { noContent, readJson, withApi } from "@/lib/api";
import { apiError } from "@/lib/api-auth";
import { deleteCompany, getCompany, updateCompany } from "@/lib/crm";

type Ctx = RouteContext<"/api/v1/companies/[id]">;

export function GET(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    const company = await getCompany(actor, (await ctx.params).id);
    return company ? Response.json(company) : apiError(404, "Company not found");
  });
}

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) =>
    Response.json(await updateCompany(actor, (await ctx.params).id, await readJson(req))),
  );
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    await deleteCompany(actor, (await ctx.params).id);
    return noContent();
  });
}
