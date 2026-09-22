import "server-only";
import crypto from "node:crypto";
import net from "node:net";
import { Agent } from "undici";
import type { CrmEvent } from "@/lib/constants";
import { env, features } from "@/lib/env";
import { CrmError } from "@/lib/errors";
import { enqueueJob, registerJobHandler, RetryableJobError } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl } from "@/lib/ssrf";

const MAX_ATTEMPTS = 3;
const AUTO_DISABLE_AFTER = 10; // consecutive failed deliveries

export function signPayload(secret: string, body: string) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Enqueues one durable delivery job per matching active hook — the actual
 * HTTP attempt happens in the job queue (see runWebhookDeliveryJob below),
 * not inline here, so a delivery that's mid-retry survives a crash or
 * redeploy instead of being silently dropped.
 */
export async function deliverWebhooks(event: CrmEvent, data: unknown) {
  if (!features.webhooks) return;
  const hooks = await prisma.webhook.findMany({ where: { active: true } });
  const targets = hooks.filter((h) =>
    h.events.split(",").some((e) => {
      const name = e.trim();
      return name === "*" || name === event;
    }),
  );
  await Promise.all(
    targets.map((hook) =>
      // The same delivery id is sent on every retry so receivers can de-duplicate.
      enqueueJob(
        "webhook_delivery",
        { hookId: hook.id, deliveryId: crypto.randomUUID(), event, data },
        { maxAttempts: MAX_ATTEMPTS },
      ),
    ),
  );
}

function isRetryable(status: number) {
  return status === 0 || status === 429 || status >= 500;
}

/**
 * Pins the connection to an address we already validated as public, instead
 * of letting fetch() re-resolve the hostname itself. Without this, a second,
 * independent DNS lookup happens right as the request goes out; an attacker
 * controlling the DNS server for the webhook's hostname can answer the first
 * lookup (assertPublicUrl) with a public IP and the second (fetch's own) with
 * an internal one, turning an approved URL into an SSRF against internal
 * services (DNS rebinding). TLS servername/cert validation still uses the
 * original hostname, so this doesn't weaken certificate checking.
 */
function pinnedDispatcher(addresses: string[]) {
  return new Agent({
    connect: {
      // Node's net.connect() calls this with { all: true } by default
      // (happy-eyeballs), expecting the array-form callback rather than the
      // classic single-address one — both are handled here.
      lookup: (_hostname, options, callback) => {
        const address = addresses[0];
        if (!address) {
          callback(new Error("No pinned address available"), options?.all ? [] : "", 4);
          return;
        }
        const family = net.isIPv6(address) ? 6 : 4;
        if (options?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
    },
  });
}

type WebhookDeliveryPayload = { hookId: string; deliveryId: string; event: CrmEvent; data: unknown };

async function runWebhookDeliveryJob(rawPayload: unknown, ctx: { attempt: number; maxAttempts: number }) {
  const { hookId, deliveryId, event, data } = rawPayload as WebhookDeliveryPayload;
  const hook = await prisma.webhook.findUnique({ where: { id: hookId } });
  if (!hook || !hook.active) return; // paused or deleted since this was enqueued: nothing to do

  const body = JSON.stringify({ id: deliveryId, event, data, sentAt: new Date().toISOString() });
  let status = 0;
  let error: string | null = null;
  let blocked = false;

  try {
    const { addresses } = await assertPublicUrl(hook.url, env.ALLOW_PRIVATE_WEBHOOKS);
    const res = await fetch(hook.url, {
      method: "POST",
      redirect: "manual", // never follow redirects to internal hosts
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "fullstack-crm-webhooks/1.0",
        "X-CRM-Event": event,
        "X-CRM-Signature": signPayload(hook.secret, body),
        "X-CRM-Delivery-Attempt": String(ctx.attempt),
      },
      body,
      signal: AbortSignal.timeout(5000),
      ...(addresses.length > 0 && { dispatcher: pinnedDispatcher(addresses) }),
    });
    status = res.status;
    error = res.ok ? null : `HTTP ${res.status}`;
  } catch (err) {
    status = 0;
    error = err instanceof Error ? err.message : String(err);
    blocked = err instanceof CrmError; // e.g. SSRF guard: retrying won't help
  }

  await prisma.webhook.update({ where: { id: hook.id }, data: { lastStatus: status, lastError: error, lastDeliveredAt: new Date() } });

  const ok = status >= 200 && status < 300;
  if (ok) {
    await prisma.webhook.update({ where: { id: hook.id }, data: { failureCount: 0 } });
    return;
  }

  const retryable = !blocked && isRetryable(status);
  const terminal = !retryable || ctx.attempt >= ctx.maxAttempts; // this job won't be retried again
  if (terminal) {
    const updated = await prisma.webhook.update({ where: { id: hook.id }, data: { failureCount: { increment: 1 } } });
    if (updated.failureCount >= AUTO_DISABLE_AFTER) {
      await prisma.webhook.update({ where: { id: hook.id }, data: { active: false } });
    }
  }
  if (retryable) throw new RetryableJobError(error ?? "delivery failed");
  throw new Error(error ?? "delivery failed");
}

registerJobHandler("webhook_delivery", runWebhookDeliveryJob);
