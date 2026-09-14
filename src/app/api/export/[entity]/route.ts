import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { EXPORTABLE_ENTITIES, type ExportableEntity } from "@/lib/constants";
import { can, ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Prevent spreadsheet formula injection when the CSV is opened in Excel/Sheets.
function safeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

async function rowsFor(entity: ExportableEntity, where: { ownerId?: string }): Promise<Record<string, unknown>[]> {
  const related = { owner: { select: { name: true } } } as const;
  switch (entity) {
    case "contacts": {
      const rows = await prisma.contact.findMany({
        where,
        include: { ...related, company: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        title: c.title,
        status: c.status,
        source: c.source,
        tags: c.tags,
        company: c.company?.name,
        owner: c.owner?.name,
        createdAt: c.createdAt,
      }));
    }
    case "companies": {
      const rows = await prisma.company.findMany({ where, include: related, orderBy: { name: "asc" } });
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        domain: c.domain,
        industry: c.industry,
        size: c.size,
        phone: c.phone,
        address: c.address,
        owner: c.owner?.name,
        createdAt: c.createdAt,
      }));
    }
    case "deals": {
      const rows = await prisma.deal.findMany({
        where,
        include: {
          ...related,
          company: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        currency: d.currency,
        stage: d.stage,
        probability: d.probability,
        expectedClose: d.expectedClose,
        closedAt: d.closedAt,
        company: d.company?.name,
        contact: d.contact ? `${d.contact.firstName} ${d.contact.lastName}`.trim() : null,
        owner: d.owner?.name,
        createdAt: d.createdAt,
      }));
    }
  }
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/export/[entity]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!can.exportData(user)) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { entity } = await ctx.params;
  if (!(EXPORTABLE_ENTITIES as readonly string[]).includes(entity)) {
    return Response.json({ error: "Unknown export type" }, { status: 404 });
  }

  const rows = await rowsFor(entity as ExportableEntity, ownerScope(user));
  const csv = Papa.unparse(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)]))));
  const filename = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;

  // Leading BOM so Excel opens UTF-8 (names like "Müller") correctly.
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
