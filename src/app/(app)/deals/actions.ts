"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt } from "@/lib/actions";
import { createDeal, deleteDeal, updateDeal } from "@/lib/crm";
import type { ActionState } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { formToObject } from "@/lib/validation";

export async function createDealAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const result = await attempt(async () => {
    id = (await createDeal(user, formToObject(formData))).id;
  });
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  redirect(`/deals/${id}`);
}

export async function updateDealAction(id: string, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => updateDeal(user, id, formToObject(formData)));
  if (!result.ok) return result;
  revalidatePath("/", "layout");
  return { ok: true, message: "Changes saved." };
}

/** Used by the Kanban board (called directly from the client). */
export async function moveDealAction(id: string, stage: string): Promise<ActionState> {
  const user = await requireUser();
  const result = await attempt(() => updateDeal(user, id, { stage }));
  revalidatePath("/", "layout");
  return result;
}

/** Used by the stage buttons on the deal page (form action). */
export async function setDealStageAction(id: string, stage: string) {
  const user = await requireUser();
  await updateDeal(user, id, { stage });
  revalidatePath("/", "layout");
}

export async function deleteDealAction(id: string) {
  const user = await requireUser();
  await deleteDeal(user, id);
  revalidatePath("/", "layout");
  redirect("/deals");
}
