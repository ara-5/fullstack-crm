import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env, features } from "@/lib/env";
import { prisma } from "@/lib/prisma";

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  transporter = features.smtp
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : null;
  return transporter;
}

type SendEmailInput = { to: string; subject: string; body: string; contactId?: string | null };

/**
 * Sends through SMTP when configured (never in demo mode); otherwise logs.
 * Every attempt is recorded in EmailLog so it shows on the contact timeline.
 */
export async function sendEmail({ to, subject, body, contactId }: SendEmailInput) {
  const t = getTransporter();
  let status = "SENT";
  let error: string | null = null;

  if (!t) {
    status = "LOGGED";
    console.info(`[email] not sent (${env.DEMO_MODE ? "demo mode" : "SMTP not configured"}). to=${to} subject="${subject}"`);
  } else {
    try {
      await t.sendMail({ from: env.EMAIL_FROM, to, subject, text: body });
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message : String(err);
    }
  }

  await prisma.emailLog.create({ data: { to, subject, body, status, error, contactId } });
  return { status, error };
}
