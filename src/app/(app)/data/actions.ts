"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createCompany, createContact, type Actor } from "@/lib/crm";
import { normalizeHeader, splitFullName } from "@/lib/csv";
import { errorToActionState, type ActionState } from "@/lib/errors";
import { can, ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 5000;

function describe(err: unknown) {
  const state = errorToActionState(err);
  if (state.fieldErrors) {
    return Object.entries(state.fieldErrors)
      .map(([field, messages]) => `${field}: ${messages[0]}`)
      .join("; ");
  }
  return state.error ?? "Unknown error";
}

async function companyIdFor(actor: Actor, name: string, cache: Map<string, string>) {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await prisma.company.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" }, ...ownerScope(actor) },
    select: { id: true },
  });
  const id = existing?.id ?? (await createCompany(actor, { name: trimmed })).id;
  cache.set(key, id);
  return id;
}

export async function importCsvAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!can.importData(user)) return { error: "Only managers and admins can import data." };

  const entity = formData.get("entity") === "companies" ? "companies" : "contacts";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 2 MB." };

  const { data: rows, errors: parseErrors } = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  if (rows.length === 0) return { error: parseErrors[0]?.message ?? "The file has no data rows." };
  if (rows.length > MAX_ROWS) return { error: `Import at most ${MAX_ROWS} rows at a time.` };

  let imported = 0;
  const problems: string[] = [];
  const companyCache = new Map<string, string>();

  for (const [index, row] of rows.entries()) {
    try {
      if (entity === "companies") {
        await createCompany(user, {
          name: row.name ?? row.company,
          domain: row.domain,
          industry: row.industry,
          size: row.size,
          phone: row.phone,
          address: row.address,
        });
      } else {
        const names = !row.firstName && row.name ? splitFullName(row.name) : { firstName: row.firstName, lastName: row.lastName };
        await createContact(
          user,
          {
            ...names,
            email: row.email,
            phone: row.phone,
            title: row.title,
            status: row.status?.trim().toUpperCase() || undefined,
            source: row.source,
            tags: row.tags,
            companyId: row.company ? await companyIdFor(user, row.company, companyCache) : undefined,
          },
          // Don't fire "contact.created" automations (e.g. welcome emails) for bulk imports.
          { emit: false },
        );
      }
      imported++;
    } catch (err) {
      problems.push(`Row ${index + 2}: ${describe(err)}`);
    }
  }

  revalidatePath("/", "layout");
  return {
    ok: imported > 0,
    message: `Imported ${imported} of ${rows.length} ${entity}.`,
    error: problems.length ? `${problems.length} row${problems.length === 1 ? " was" : "s were"} skipped.` : undefined,
    details: problems.slice(0, 20),
  };
}
