"use server";

import { revalidatePath } from "next/cache";
import { attempt } from "@/lib/actions";
import { createActivity, deleteActivity, setActivityCompleted } from "@/lib/crm";
import type { ActionState } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { formToObject } from "@/lib/validation";

export async function createActivityAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => createActivity(user, formToObject(formData)));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function toggleActivityAction(id: string, completed: boolean) {
  const user = await requireUser();
  await setActivityCompleted(user, id, completed);
  revalidatePath("/", "layout");
}

export async function deleteActivityAction(id: string) {
  const user = await requireUser();
  await deleteActivity(user, id);
  revalidatePath("/", "layout");
}
