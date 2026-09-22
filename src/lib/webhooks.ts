import "server-only";
import crypto from "node:crypto";
import net from "node:net";
import { Agent } from "undici";
import type { Webhook } from "@prisma/client";
import type { CrmEvent } from "@/lib/constants";
import { env, features } from "@/lib/env";
import { CrmError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl } from "@/lib/ssrf";

const MAX_ATTEMPTS = 3;
const AUTO_DISABLE_AFTER = 10; // consecutive failed deliveries

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function signPayload(secret: string, body: string) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export async function deliverWebhooks(event: CrmEvent, data: unknown) {
  if (!features.webhooks) return;
  const hooks = await prisma.webhook.findMany({ where: { active: true } });
  const targets = hooks.filter((h) =>
    h.events.split(",").some((e) => {
      const name = e.trim();
      return name === "*" || name === event;
    }),
  );
  await Promise.allSettled(targets.map((hook) => deliver(hook, event, data)));
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

async function deliver(hook: Webhook, event: CrmEvent, data: unknown) {
  // The same delivery id is sent on every retry so receivers can de-duplicate.
  const body = JSON.stringify({ id: crypto.randomUUID(), event, data, sentAt: new Date().toISOString() });
  let status = 0;
  let error: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
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
          "X-CRM-Delivery-Attempt": String(attempt),
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
      if (err instanceof CrmError) break; // blocked URL: retrying won't help
    }
    if (!isRetryable(status) || attempt === MAX_ATTEMPTS) break;
    await sleep(1000 * 4 ** (attempt - 1)); // 1s, then 4s
  }

  const ok = status >= 200 && status < 300;
  const failureCount = ok ? 0 : hook.failureCount + 1;
  await prisma.webhook.update({
    where: { id: hook.id },
    data: {
      lastStatus: status,
      lastError: error,
      lastDeliveredAt: new Date(),
      failureCount,
      ...(failureCount >= AUTO_DISABLE_AFTER && { active: false }),
    },
  });
}
