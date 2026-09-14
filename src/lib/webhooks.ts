import "server-only";
import crypto from "node:crypto";
import type { Webhook } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CrmEvent } from "@/lib/constants";

export function signPayload(secret: string, body: string) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverWebhooks(event: CrmEvent, data: unknown) {
  const hooks = await prisma.webhook.findMany({ where: { active: true } });
  const targets = hooks.filter((h) =>
    h.events.split(",").some((e) => {
      const name = e.trim();
      return name === "*" || name === event;
    }),
  );
  await Promise.allSettled(targets.map((hook) => deliver(hook, event, data)));
}

async function deliver(hook: Webhook, event: CrmEvent, data: unknown) {
  const body = JSON.stringify({ event, data, sentAt: new Date().toISOString() });
  let status = 0; // 0 = network error / timeout
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CRM-Event": event,
        "X-CRM-Signature": signPayload(hook.secret, body),
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    status = res.status;
  } catch (err) {
    console.warn(`[webhook] delivery to ${hook.url} failed:`, err);
  }
  await prisma.webhook.update({
    where: { id: hook.id },
    data: { lastStatus: status, lastDeliveredAt: new Date() },
  });
}
