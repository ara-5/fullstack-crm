import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";

let transporter: Transporter | null | undefined;

function getTransporter() {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  transporter = host
    ? nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_PORT === "465",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : null;
  return transporter;
}

type SendEmailInput = { to: string; subject: string; body: string; contactId?: string | null };

/**
 * Sends through SMTP when configured; otherwise logs to the console.
 * Every attempt is recorded in EmailLog so it shows on the contact timeline.
 */
export async function sendEmail({ to, subject, body, contactId }: SendEmailInput) {
  const t = getTransporter();
  let status = "SENT";
  let error: string | null = null;

  if (!t) {
    status = "LOGGED";
    console.info(`[email] SMTP not configured, not sent. to=${to} subject="${subject}"`);
  } else {
    try {
      await t.sendMail({
        from: process.env.EMAIL_FROM ?? "CRM <no-reply@crm.local>",
        to,
        subject,
        text: body,
      });
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message : String(err);
    }
  }

  await prisma.emailLog.create({ data: { to, subject, body, status, error, contactId } });
  return { status, error };
}
