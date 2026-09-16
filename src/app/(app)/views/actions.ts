"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/errors";
import { createSavedView, deleteSavedView, SAVED_VIEW_ENTITIES, type SavedViewEntity } from "@/lib/saved-views";
import { requireUser } from "@/lib/session";

function isSavedViewEntity(value: string): value is SavedViewEntity {
  return (SAVED_VIEW_ENTITIES as readonly string[]).includes(value);
}

export async function createSavedViewAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const entity = String(formData.get("entity") ?? "");
  if (!isSavedViewEntity(entity)) return { error: "Invalid view type." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Name this view.", fieldErrors: { name: ["Required"] } };

  let filters: Record<string, string> = {};
  try {
    filters = JSON.parse(String(formData.get("filters") ?? "{}"));
  } catch {
    filters = {};
  }

  await createSavedView(user.id, entity, name, filters);
  revalidatePath(`/${entity}`);
  return { ok: true, message: "View saved." };
}

export async function deleteSavedViewAction(entity: string, id: string) {
  const user = await requireUser();
  await deleteSavedView(user.id, id);
  if (isSavedViewEntity(entity)) revalidatePath(`/${entity}`);
}
