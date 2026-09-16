import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateRecoveryCodes, verifyTotp } from "@/lib/totp";

type LoginCandidate = {
  id: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorRecoveryCodes: unknown;
};

/**
 * Checks a login-time code against the user's TOTP secret or their unused
 * recovery codes. A matched recovery code is consumed (removed) so it can't
 * be replayed.
 */
export async function verifyLoginCode(user: LoginCandidate, rawCode: string): Promise<boolean> {
  const code = rawCode.trim();
  if (user.twoFactorSecret && /^\d{6}$/.test(code) && verifyTotp(user.twoFactorSecret, code)) return true;

  const hashes = Array.isArray(user.twoFactorRecoveryCodes) ? (user.twoFactorRecoveryCodes as string[]) : [];
  const normalized = code.toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecoveryCodes: remaining } });
      return true;
    }
  }
  return false;
}

/** Hashes and stores a fresh set of recovery codes, returning the plaintext codes to show once. */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  await prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: hashes } });
  return codes;
}
