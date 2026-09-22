import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateRecoveryCodes, verifyTotpStep } from "@/lib/totp";

type LoginCandidate = {
  id: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorRecoveryCodes: unknown;
  twoFactorLastUsedStep: number | null;
};

/**
 * Checks a login-time code against the user's TOTP secret or their unused
 * recovery codes. A matched recovery code is consumed (removed) so it can't
 * be replayed. A matched TOTP code is only accepted once: we persist the
 * step counter it matched and reject any code at that step or earlier, so a
 * code captured in transit (phishing relay, shoulder-surfing, browser
 * extension) can't be replayed for as long as it stays within the drift
 * window.
 */
export async function verifyLoginCode(user: LoginCandidate, rawCode: string): Promise<boolean> {
  const code = rawCode.trim();
  if (user.twoFactorSecret && /^\d{6}$/.test(code)) {
    const step = verifyTotpStep(user.twoFactorSecret, code);
    if (step !== null) {
      // Conditional update, not read-then-write: two concurrent requests
      // replaying the same code could otherwise both pass the check above
      // before either one persists it. Only the request that actually
      // advances twoFactorLastUsedStep wins.
      const { count } = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ twoFactorLastUsedStep: null }, { twoFactorLastUsedStep: { lt: step } }] },
        data: { twoFactorLastUsedStep: step },
      });
      return count > 0;
    }
  }

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
