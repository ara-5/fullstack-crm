import type { NextRequest } from "next/server";
import { noContent, readJson, withApi } from "@/lib/api";
import { apiError } from "@/lib/api-auth";
import { deleteContact, getContact, updateContact } from "@/lib/crm";

type Ctx = RouteContext<"/api/v1/contacts/[id]">;

export function GET(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    const contact = await getContact(actor, (await ctx.params).id);
    return contact ? Response.json(contact) : apiError(404, "Contact not found");
  });
}

export function PATCH(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) =>
    Response.json(await updateContact(actor, (await ctx.params).id, await readJson(req))),
  );
}

export function DELETE(req: NextRequest, ctx: Ctx) {
  return withApi(req, async (actor) => {
    await deleteContact(actor, (await ctx.params).id);
    return noContent();
  });
}
