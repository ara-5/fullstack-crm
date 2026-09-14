import type { NextRequest } from "next/server";
import { listOptions, readJson, withApi } from "@/lib/api";
import { createContact, listContacts } from "@/lib/crm";

export function GET(req: NextRequest) {
  return withApi(req, async (actor) => {
    const { q, page, pageSize, params } = listOptions(req);
    const result = await listContacts(actor, {
      q,
      page,
      pageSize,
      status: params.get("status") ?? undefined,
      companyId: params.get("companyId") ?? undefined,
    });
    return Response.json(result);
  });
}

export function POST(req: NextRequest) {
  return withApi(req, async (actor) =>
    Response.json(await createContact(actor, await readJson(req)), { status: 201 }),
  );
}
