import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, hit, isLimited } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/** Thrown when too many failed logins were recorded for this email or IP. */
export class TooManyLoginAttempts extends CredentialsSignin {
  code = "rate_limited";
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 10;
const MAX_FAILURES_PER_IP = 50;

// Compared against when the user doesn't exist, so response time doesn't reveal valid emails.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-a-real-password", 10));

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw, request) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        // Only failed attempts count, so shared demo accounts are never locked by normal use.
        const ip = clientIp(request.headers);
        const emailKey = `login:email:${email}`;
        const ipKey = ip === "unknown" ? null : `login:ip:${ip}`;
        const [emailLimited, ipLimited] = await Promise.all([
          isLimited(emailKey, MAX_FAILURES_PER_EMAIL),
          ipKey ? isLimited(ipKey, MAX_FAILURES_PER_IP) : false,
        ]);
        if (emailLimited || ipLimited) throw new TooManyLoginAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? getDummyHash());
        if (!user || !user.active || !valid) {
          await Promise.all([
            hit(emailKey, MAX_FAILURES_PER_EMAIL, LOGIN_WINDOW_MS),
            ipKey ? hit(ipKey, MAX_FAILURES_PER_IP, LOGIN_WINDOW_MS) : null,
          ]);
          return null;
        }

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      // Role and active status are re-read from the database in getCurrentUser(),
      // so a demoted or deactivated user loses access immediately.
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});
