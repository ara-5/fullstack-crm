"use server";

import { revalidatePath } from "next/cache";
import { attempt } from "@/lib/actions";
import { forbidden, type ActionState } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formToObject, ruleInput } from "@/lib/validation";

function compact(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ""));
}

async function requireAutomationManager() {
  const user = await requireUser();
  if (!can.manageAutomations(user)) throw forbidden();
  return user;
}

export async function createRuleAction(formData: FormData): Promise<ActionState> {
  await requireAutomationManager();
  const result = await attempt(async () => {
    const v = ruleInput.parse(formToObject(formData));
    const conditions = compact({
      toStage: v.toStage,
      fromStage: v.fromStage,
      minValue: v.minValue,
      contactStatus: v.contactStatus,
    });
    const actionConfig =
      v.action === "CREATE_TASK"
        ? compact({ subject: v.subject, body: v.body, dueInDays: v.dueInDays ?? 1, priority: v.priority ?? "MEDIUM" })
        : v.action === "SEND_EMAIL"
          ? compact({ subject: v.subject, body: v.body, to: v.emailTo ?? "contact" })
          : compact({ status: v.status });

    await prisma.automationRule.create({
      data: {
        name: v.name,
        trigger: v.trigger,
        action: v.action,
        conditions: JSON.stringify(conditions),
        actionConfig: JSON.stringify(actionConfig),
      },
    });
  });
  if (!result.ok) return result;
  revalidatePath("/automations");
  return { ok: true, message: "Automation created." };
}

export async function toggleRuleAction(id: string) {
  await requireAutomationManager();
  const rule = await prisma.automationRule.findUnique({ where: { id }, select: { active: true } });
  if (rule) await prisma.automationRule.update({ where: { id }, data: { active: !rule.active } });
  revalidatePath("/automations");
}

export async function deleteRuleAction(id: string) {
  await requireAutomationManager();
  await prisma.automationRule.deleteMany({ where: { id } });
  revalidatePath("/automations");
}
