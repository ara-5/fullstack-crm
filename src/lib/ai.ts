import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Activity, Company, Contact, Deal } from "@prisma/client";
import { CrmError } from "@/lib/errors";
import { env, features } from "@/lib/env";
import { formatCurrency, formatDate } from "@/lib/utils";

let client: Anthropic | null | undefined;
function getClient() {
  if (client !== undefined) return client;
  client = features.ai ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  return client;
}

const insightsSchema = z.object({
  summary: z.string().describe("2-3 sentence summary of where this deal stands and what has happened recently"),
  riskLevel: z.enum(["low", "medium", "high"]).describe("Risk of this deal stalling or being lost"),
  nextSteps: z.array(z.string()).min(1).max(4).describe("Concrete, specific next actions for the rep to take"),
  emailDraft: z.object({
    subject: z.string(),
    body: z.string().describe("A short, professional follow-up email in the rep's voice, plain text, no markdown"),
  }),
});

export type DealInsights = z.infer<typeof insightsSchema>;

type DealForAi = Deal & {
  company: Pick<Company, "name" | "industry"> | null;
  contact: Pick<Contact, "firstName" | "lastName" | "title"> | null;
  activities: Pick<Activity, "type" | "subject" | "body" | "createdAt" | "completedAt" | "dueAt">[];
};

function buildPrompt(deal: DealForAi) {
  const timeline = deal.activities
    .slice(0, 15)
    .map((a) => `- [${a.type}] ${formatDate(a.createdAt)}: ${a.subject}${a.body ? ` — ${a.body}` : ""}`)
    .join("\n") || "(no activity logged yet)";

  return `Deal: ${deal.title}
Value: ${formatCurrency(deal.value, deal.currency)}
Stage: ${deal.stage} (${deal.probability}% probability)
Company: ${deal.company?.name ?? "unknown"}${deal.company?.industry ? ` (${deal.company.industry})` : ""}
Contact: ${deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}${deal.contact.title ? `, ${deal.contact.title}` : ""}` : "none"}
Expected close: ${deal.expectedClose ? formatDate(deal.expectedClose) : "not set"}

Activity timeline (most recent first):
${timeline}`;
}

/**
 * Summarizes a deal's timeline and drafts a follow-up email. Costs a real API
 * call — callers should cache the result (Deal.aiInsights) rather than call
 * this on every page view.
 */
export async function generateDealInsights(deal: DealForAi): Promise<DealInsights> {
  const anthropic = getClient();
  if (!anthropic) throw new CrmError(503, "The AI assistant is not configured (ANTHROPIC_API_KEY is not set).");

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    system:
      "You are a sales assistant embedded in a CRM. Read the deal's activity timeline and produce a factual " +
      "summary, a risk assessment, and a short follow-up email draft. Only reference facts present in the " +
      "timeline — never invent commitments, prices, or dates that weren't given.",
    messages: [{ role: "user", content: buildPrompt(deal) }],
    output_config: { format: zodOutputFormat(insightsSchema), effort: "medium" },
  });

  if (response.stop_reason === "refusal") {
    throw new CrmError(502, "The AI assistant declined to respond to this request.");
  }
  if (!response.parsed_output) {
    throw new CrmError(502, "The AI assistant returned an unexpected response. Please try again.");
  }
  return response.parsed_output;
}
