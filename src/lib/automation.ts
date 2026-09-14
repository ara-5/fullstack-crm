import "server-only";
import { after } from "next/server";
import type { Activity, AutomationRule, Contact, Deal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { deliverWebhooks } from "@/lib/webhooks";
import type { CrmEvent } from "@/lib/constants";
import { addDays, parseJson } from "@/lib/utils";

export type EventPayload = {
  actorId: string;
  contact?: Contact | null;
  deal?: Deal | null;
  activity?: Activity | null;
  fromStage?: string;
  toStage?: string;
};

type Conditions = {
  toStage?: string;
  fromStage?: string;
  minValue?: number;
  contactStatus?: string;
};

type ActionConfig = {
  subject?: string;
  body?: string;
  dueInDays?: number;
  priority?: string;
  status?: string;
  to?: "contact" | "owner";
};

/**
 * Entry point for every domain event. Automations run inline so their effects
 * (e.g. a created task) are visible when the page revalidates; webhooks are
 * delivered after the response is sent.
 */
export async function emitEvent(event: CrmEvent, payload: EventPayload) {
  try {
    await runAutomations(event, payload);
  } catch (err) {
    console.error(`[automation] failed while handling ${event}:`, err);
  }

  const { actorId, ...data } = payload;
  after(() => deliverWebhooks(event, { ...data, actorId }));
}

async function runAutomations(event: CrmEvent, payload: EventPayload) {
  const rules = await prisma.automationRule.findMany({ where: { active: true, trigger: event } });
  if (rules.length === 0) return;

  // Deal events often need the related contact (for emails / status updates).
  if (!payload.contact && payload.deal?.contactId) {
    payload.contact = await prisma.contact.findUnique({ where: { id: payload.deal.contactId } });
  }

  for (const rule of rules) {
    if (!matches(parseJson<Conditions>(rule.conditions, {}), payload)) continue;
    await executeAction(rule, payload);
    await prisma.automationRule.update({
      where: { id: rule.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });
  }
}

export function matches(c: Conditions, p: EventPayload) {
  if (c.toStage && c.toStage !== p.toStage) return false;
  if (c.fromStage && c.fromStage !== p.fromStage) return false;
  if (c.minValue != null && (p.deal?.value ?? 0) < Number(c.minValue)) return false;
  if (c.contactStatus && p.contact?.status !== c.contactStatus) return false;
  return true;
}

/** Replaces {{contact.firstName}}, {{deal.title}}, etc. with payload values. */
export function interpolate(template: string, p: EventPayload) {
  return template.replace(/\{\{\s*(contact|deal|activity)\.(\w+)\s*\}\}/g, (_, obj: string, field: string) => {
    const source = p[obj as "contact" | "deal" | "activity"] as Record<string, unknown> | null | undefined;
    const value = source?.[field];
    return value == null ? "" : String(value);
  });
}

async function executeAction(rule: AutomationRule, p: EventPayload) {
  const config = parseJson<ActionConfig>(rule.actionConfig, {});
  const ownerId = p.deal?.ownerId ?? p.contact?.ownerId ?? p.activity?.ownerId ?? p.actorId;

  switch (rule.action) {
    case "CREATE_TASK": {
      await prisma.activity.create({
        data: {
          type: "TASK",
          subject: interpolate(config.subject || `Follow up (${rule.name})`, p),
          body: config.body ? interpolate(config.body, p) : null,
          priority: config.priority ?? "MEDIUM",
          dueAt: addDays(new Date(), Number(config.dueInDays ?? 1)),
          dealId: p.deal?.id ?? p.activity?.dealId ?? null,
          contactId: p.contact?.id ?? p.activity?.contactId ?? null,
          companyId: p.deal?.companyId ?? p.contact?.companyId ?? p.activity?.companyId ?? null,
          ownerId,
        },
      });
      break;
    }
    case "SEND_EMAIL": {
      let to = p.contact?.email ?? null;
      if (config.to === "owner" && ownerId) {
        to = (await prisma.user.findUnique({ where: { id: ownerId } }))?.email ?? null;
      }
      if (!to) return;
      await sendEmail({
        to,
        subject: interpolate(config.subject ?? rule.name, p),
        body: interpolate(config.body ?? "", p),
        contactId: p.contact?.id,
      });
      break;
    }
    case "UPDATE_CONTACT_STATUS": {
      if (!p.contact || !config.status) return;
      await prisma.contact.update({ where: { id: p.contact.id }, data: { status: config.status } });
      break;
    }
  }
}
