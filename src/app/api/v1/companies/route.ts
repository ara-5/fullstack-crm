import type { NextRequest } from "next/server";
import { listOptions, readJson, withApi } from "@/lib/api";
import { createCompany, listCompanies } from "@/lib/crm";

export function GET(req: NextRequest) {
  return withApi(req, async (actor) => {
    const { q, page, pageSize } = listOptions(req);
    return Response.json(await listCompanies(actor, { q, page, pageSize }));
  });
}

export function POST(req: NextRequest) {
  return withApi(req, async (actor) =>
    Response.json(await createCompany(actor, await readJson(req)), { status: 201 }),
  );
}
