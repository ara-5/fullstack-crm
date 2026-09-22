import "server-only";
import { z } from "zod";

// Validated once at startup so a misconfigured deploy fails loudly with a clear
// message instead of breaking at the first request that needs a variable.

const flag = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters").optional(),
    CURRENCY: z.string().length(3, "CURRENCY must be a 3-letter ISO code").toUpperCase().default("USD"),
    DEMO_MODE: flag,
    CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
    ALLOW_PRIVATE_WEBHOOKS: flag,
    TRUST_PROXY_HEADERS: flag,
    ANTHROPIC_API_KEY: z.string().optional(),
    // Anthropic doesn't offer an embeddings endpoint; Voyage AI is their
    // recommended embedding partner. Optional — semantic search and the AI
    // assistant's record retrieval are hidden/degraded without it.
    VOYAGE_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default("CRM <no-reply@crm.local>"),
    SOURCE_CODE_URL: z.url().default("https://github.com/ara-5/fullstack-crm"),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === "production" && !v.AUTH_SECRET) {
      ctx.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "AUTH_SECRET is required in production" });
    }
  });

function loadEnv() {
  // Treat empty strings (e.g. SMTP_HOST="") as unset.
  const raw = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const features = {
  ai: Boolean(env.ANTHROPIC_API_KEY),
  smtp: Boolean(env.SMTP_HOST) && !env.DEMO_MODE,
  webhooks: !env.DEMO_MODE,
  semanticSearch: Boolean(env.VOYAGE_API_KEY),
};
