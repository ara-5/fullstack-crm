"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt } from "@/lib/actions";
import { generateDealInsights } from "@/lib/ai";
import { createDeal, deleteDeal, updateDeal } from "@/lib/crm";
import { forbidden, type ActionState } from "@/lib/errors";
import { ownerScope } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hit, retryAfterSeconds } from "@/lib/rate-limit";
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

const AI_LIMIT = 10; // per user per hour — this action costs a real API call
const AI_WINDOW_MS = 60 * 60 * 1000;

/** Summarizes a deal's timeline and drafts a follow-up email, and caches the result. */
export async function generateInsightsAction(id: string): Promise<ActionState> {
  const user = await requireUser();
  const limit = await hit(`ai:${user.id}`, AI_LIMIT, AI_WINDOW_MS);
  if (!limit.ok) {
    return { error: `You've reached the AI assistant limit. Try again in ${Math.ceil(retryAfterSeconds(limit.resetAt) / 60)} min.` };
  }

  const result = await attempt(async () => {
    const deal = await prisma.deal.findFirst({
      where: { id, ...ownerScope(user) },
      include: {
        company: { select: { name: true, industry: true } },
        contact: { select: { firstName: true, lastName: true, title: true } },
        activities: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!deal) throw forbidden("Deal not found.");

    const insights = await generateDealInsights(deal, user.id);
    await prisma.deal.update({ where: { id }, data: { aiInsights: insights, aiInsightsAt: new Date() } });
  });
  if (!result.ok) return result;
  revalidatePath(`/deals/${id}`);
  return { ok: true };
}
