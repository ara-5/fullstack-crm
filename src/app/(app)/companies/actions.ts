"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt } from "@/lib/actions";
import { bulkDeleteCompanies, bulkReassignCompanies, createCompany, deleteCompany, updateCompany } from "@/lib/crm";
import type { ActionState } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { formToObject } from "@/lib/validation";

export async function createCompanyAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const result = await attempt(async () => {
    id = (await createCompany(user, formToObject(formData))).id;
  });
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  redirect(`/companies/${id}`);
}

export async function updateCompanyAction(id: string, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => updateCompany(user, id, formToObject(formData)));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return { ok: true, message: "Changes saved." };
}

export async function deleteCompanyAction(id: string) {
  const user = await requireUser();
  await deleteCompany(user, id);
  revalidatePath("/", "layout");
  redirect("/companies");
}

// ---------------------------------------------------------------- bulk actions

export async function bulkDeleteCompaniesAction(ids: string[]): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => bulkDeleteCompanies(user, ids));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function bulkReassignCompaniesAction(ids: string[], ownerId: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => bulkReassignCompanies(user, ids, ownerId));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
