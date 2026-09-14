"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt } from "@/lib/actions";
import { generateApiKey } from "@/lib/api-auth";
import { ROLES } from "@/lib/constants";
import { env } from "@/lib/env";
import { CrmError, forbidden, type ActionState } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertPublicUrl } from "@/lib/ssrf";
import { formToObject, passwordChange, userInput, webhookInput } from "@/lib/validation";

const DEMO_LOCKED = "This is disabled in the public demo.";

async function requireAdmin() {
  const user = await requireUser();
  if (!can.manageUsers(user)) throw forbidden();
  if (env.DEMO_MODE) throw forbidden(DEMO_LOCKED);
  return user;
}

// ---------------------------------------------------------------- profile

export async function changePasswordAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (env.DEMO_MODE) return { error: DEMO_LOCKED };
  const result = await attempt(async () => {
    const { currentPassword, newPassword } = passwordChange.parse(formToObject(formData));
    const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(currentPassword, record.passwordHash))) {
      throw new CrmError(400, "Current password is incorrect.");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
  });
  return result.ok ? { ok: true, message: "Password updated." } : result;
}

// ---------------------------------------------------------------- API keys

export async function createApiKeyAction(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Give the key a name.", fieldErrors: { name: ["Required"] } };

  const key = generateApiKey();
  await prisma.apiKey.create({ data: { name, prefix: key.prefix, keyHash: key.hash, userId: user.id } });
  revalidatePath("/settings");
  return { ok: true, message: `API key "${name}" created.`, secret: key.raw };
}

export async function revokeApiKeyAction(id: string) {
  const user = await requireUser();
  await prisma.apiKey.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings");
}

// ---------------------------------------------------------------- users (admin)

export async function createUserAction(formData: FormData): Promise<ActionState> {
  if (!can.manageUsers(await requireUser())) return { error: "Only admins can add users." };
  if (env.DEMO_MODE) return { error: DEMO_LOCKED };
  const result = await attempt(async () => {
    const { password, ...data } = userInput.parse(formToObject(formData));
    await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 10) } });
  });
  if (!result.ok) return result;
  revalidatePath("/settings");
  return { ok: true, message: "User created. Share the password with them securely." };
}

export async function updateUserRoleAction(id: string, formData: FormData) {
  const admin = await requireAdmin();
  const role = z.enum(ROLES).parse(formData.get("role"));
  if (id === admin.id) throw new CrmError(400, "You can't change your own role.");
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/settings");
}

export async function toggleUserActiveAction(id: string) {
  const admin = await requireAdmin();
  if (id === admin.id) throw new CrmError(400, "You can't deactivate yourself.");
  const user = await prisma.user.findUnique({ where: { id }, select: { active: true } });
  if (user) await prisma.user.update({ where: { id }, data: { active: !user.active } });
  revalidatePath("/settings");
}

// ---------------------------------------------------------------- webhooks (admin)

export async function createWebhookAction(formData: FormData): Promise<ActionState> {
  if (!can.manageWebhooks(await requireUser())) return { error: "Only admins can manage webhooks." };
  if (env.DEMO_MODE) return { error: "Webhooks are disabled in the public demo." };
  let secret = "";
  const result = await attempt(async () => {
    const { url, events } = webhookInput.parse({ url: formData.get("url"), events: formData.getAll("events") });
    await assertPublicUrl(url, env.ALLOW_PRIVATE_WEBHOOKS); // block SSRF to internal hosts
    secret = "whsec_" + crypto.randomBytes(24).toString("hex");
    await prisma.webhook.create({ data: { url, events: events.join(","), secret } });
  });
  if (!result.ok) return result;
  revalidatePath("/settings");
  return { ok: true, message: "Webhook added. Verify deliveries with this signing secret:", secret };
}

export async function toggleWebhookAction(id: string) {
  await requireAdmin();
  const hook = await prisma.webhook.findUnique({ where: { id }, select: { active: true } });
  if (hook) {
    await prisma.webhook.update({
      where: { id },
      data: { active: !hook.active, ...(!hook.active && { failureCount: 0, lastError: null }) },
    });
  }
  revalidatePath("/settings");
}

export async function deleteWebhookAction(id: string) {
  await requireAdmin();
  await prisma.webhook.deleteMany({ where: { id } });
  revalidatePath("/settings");
}
