"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt } from "@/lib/actions";
import { createContact, deleteContact, updateContact } from "@/lib/crm";
import type { ActionState } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { formToObject } from "@/lib/validation";

export async function createContactAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const result = await attempt(async () => {
    id = (await createContact(user, formToObject(formData))).id;
  });
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(id: string, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => updateContact(user, id, formToObject(formData)));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return { ok: true, message: "Changes saved." };
}

export async function deleteContactAction(id: string) {
  const user = await requireUser();
  await deleteContact(user, id);
  revalidatePath("/", "layout");
  redirect("/contacts");
}
