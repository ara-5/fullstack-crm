"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { issueRecoveryCodes } from "@/lib/two-factor";
import { generateTotpSecret, totpKeyUri, verifyTotp } from "@/lib/totp";

const DEMO_LOCKED = "This is disabled in the public demo.";

export type StartSetupResult = { ok: true; qrDataUrl: string; manualKey: string } | { ok: false; error: string };

/** Generates a fresh secret and stores it (disabled) until the user confirms a code. */
export async function startTwoFactorSetupAction(): Promise<StartSetupResult> {
  const user = await requireUser();
  if (env.DEMO_MODE) return { ok: false, error: DEMO_LOCKED };

  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret, twoFactorEnabled: false } });
  const uri = totpKeyUri(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 200 });
  return { ok: true, qrDataUrl, manualKey: secret };
}

export type ConfirmSetupResult = { ok: true; recoveryCodes: string[] } | { ok: false; error: string };

export async function confirmTwoFactorSetupAction(code: string): Promise<ConfirmSetupResult> {
  const user = await requireUser();
  if (env.DEMO_MODE) return { ok: false, error: DEMO_LOCKED };

  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!record.twoFactorSecret || !verifyTotp(record.twoFactorSecret, code)) {
    return { ok: false, error: "That code didn't match. Check the time on your device and try again." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  const recoveryCodes = await issueRecoveryCodes(user.id);
  revalidatePath("/settings");
  return { ok: true, recoveryCodes };
}

export async function disableTwoFactorAction() {
  const user = await requireUser();
  if (env.DEMO_MODE) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: Prisma.JsonNull },
  });
  revalidatePath("/settings");
}

export type RegenerateResult = { ok: true; recoveryCodes: string[] } | { ok: false; error: string };

export async function regenerateRecoveryCodesAction(): Promise<RegenerateResult> {
  const user = await requireUser();
  if (env.DEMO_MODE) return { ok: false, error: DEMO_LOCKED };
  const record = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!record.twoFactorEnabled) return { ok: false, error: "Two-factor authentication isn't enabled." };
  const recoveryCodes = await issueRecoveryCodes(user.id);
  return { ok: true, recoveryCodes };
}
