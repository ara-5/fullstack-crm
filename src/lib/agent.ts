import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAiLog } from "@/lib/ai-log";
import { DEAL_STAGE_IDS, PRIORITIES } from "@/lib/constants";
import { createActivity, getContact, getDeal, listActivities, listDeals, searchRecords, updateDeal, type Actor } from "@/lib/crm";
import { sendEmail } from "@/lib/email";
import { semanticSearch } from "@/lib/embeddings";
import { env, features } from "@/lib/env";
import { CrmError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/utils";

/**
 * The agentic command layer: natural-language requests, backed by tools that
 * read and write real CRM data. Read tools run immediately (they can only
 * see what the signed-in user can already see — see crm.ts's ownerScope).
 * Write tools never execute directly: they create an AgentProposal and wait
 * for the user to approve it (see approveAgentProposal), at which point the
 * *same* service-layer function the UI itself uses runs — validation,
 * permissions, and the audit log all apply exactly as normal. The assistant
 * can never do more than the signed-in user already could by hand.
 */

const MODEL = "claude-sonnet-5"; // lower latency/cost than the opus model used for deal insights — this runs interactively
const MAX_TURNS = 6;
const PROPOSAL_TTL_MS = 30 * 60 * 1000;

let client: Anthropic | null | undefined;
function getClient() {
  if (client !== undefined) return client;
  client = features.ai ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  return client;
}

const SYSTEM_PROMPT = `You are a sales assistant embedded in a CRM, talking directly to a signed-in user. You have
tools to look up contacts, companies, deals and tasks, and tools to propose changes (creating a task, moving a
deal's stage, or sending an email). Proposing a change does NOT make it happen — it only shows the user a card
they can approve or reject. Never claim you created, moved, or sent something unless a tool result explicitly says
so. Be concise. Only state facts a tool result actually gave you; never invent record details, ids, or outcomes.
If a search returns nothing relevant, say so instead of guessing.`;

// ---- tool argument schemas --------------------------------------------------

const searchArgs = z.object({ query: z.string().min(1).max(200).describe("Free text: a person's name, company, email, or deal title") });
const getDealArgs = z.object({ dealId: z.string().describe("A deal id from a previous search_records result") });
const listTasksArgs = z.object({
  view: z.enum(["open", "overdue", "today", "upcoming"]).default("open").describe("Which of the signed-in user's tasks to list"),
});
const pipelineSummaryArgs = z.object({});

const createTaskArgs = z.object({
  subject: z.string().min(1).max(200).describe('Short title, e.g. "Call about renewal"'),
  body: z.string().max(2000).optional().describe("Optional longer note"),
  dueInDays: z.number().int().min(0).max(365).default(1).describe("Days from now it's due"),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  dealId: z.string().optional().describe("Link to a deal id, if relevant"),
  contactId: z.string().optional().describe("Link to a contact id, if relevant"),
});
const updateDealStageArgs = z.object({
  dealId: z.string().describe("The deal id to move (look it up with search_records or get_deal first)"),
  stage: z.enum(DEAL_STAGE_IDS).describe("The new pipeline stage"),
});
const draftEmailArgs = z.object({
  contactId: z.string().describe("The contact id to email (must have an email address on file)"),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000).describe("Plain-text email body"),
});

// ---- tool definitions --------------------------------------------------------

type ReadTool = {
  kind: "read";
  name: string;
  description: string;
  schema: z.ZodType;
  run: (args: never, actor: Actor) => Promise<unknown>;
};
type WriteTool = {
  kind: "write";
  name: string;
  description: string;
  schema: z.ZodType;
  summarize: (args: never, actor: Actor) => Promise<string>;
  apply: (args: never, actor: Actor) => Promise<{ resultId?: string; message: string }>;
};
type ToolDef = ReadTool | WriteTool;

const TOOLS: ToolDef[] = [
  {
    kind: "read",
    name: "search_records",
    description: "Search contacts, companies and deals by name, email, domain or title. Use this to find a record's id before acting on it.",
    schema: searchArgs,
    run: async (args: z.infer<typeof searchArgs>, actor) => {
      const [keyword, semantic] = await Promise.all([searchRecords(actor, args.query), semanticSearch(actor, args.query, 5)]);
      const seen = new Set<string>();
      return [...keyword, ...semantic]
        .filter((r) => (seen.has(`${r.group}:${r.id}`) ? false : (seen.add(`${r.group}:${r.id}`), true)))
        .slice(0, 10);
    },
  },
  {
    kind: "read",
    name: "get_deal",
    description: "Full detail on one deal: value, stage, company, contact, and its recent activity timeline.",
    schema: getDealArgs,
    run: async (args: z.infer<typeof getDealArgs>, actor) => {
      const deal = await getDeal(actor, args.dealId);
      if (!deal) throw new CrmError(404, "Deal not found, or not visible to this user.");
      return deal;
    },
  },
  {
    kind: "read",
    name: "list_tasks",
    description: "The signed-in user's own tasks, filtered by view (open, overdue, today, upcoming).",
    schema: listTasksArgs,
    run: async (args: z.infer<typeof listTasksArgs>, actor) => listActivities(actor, { view: args.view, mine: true, take: 25 }),
  },
  {
    kind: "read",
    name: "pipeline_summary",
    description: "Aggregate view of open deals (count and total value per stage) and how many tasks are overdue.",
    schema: pipelineSummaryArgs,
    run: async (_args, actor) => {
      const [deals, overdue] = await Promise.all([listDeals(actor, {}), listActivities(actor, { view: "overdue" })]);
      const byStage: Record<string, { count: number; value: number }> = {};
      for (const d of deals) {
        const s = (byStage[d.stage] ??= { count: 0, value: 0 });
        s.count += 1;
        s.value += d.value;
      }
      return { byStage, overdueTaskCount: overdue.length };
    },
  },
  {
    kind: "write",
    name: "create_task",
    description: "Propose creating a task (to-do) for the signed-in user. Needs the user's approval before it's actually created.",
    schema: createTaskArgs,
    summarize: async (args: z.infer<typeof createTaskArgs>) =>
      `Create task "${args.subject}", due in ${args.dueInDays} day(s)${args.priority !== "MEDIUM" ? ` (${args.priority.toLowerCase()} priority)` : ""}.`,
    apply: async (args: z.infer<typeof createTaskArgs>, actor) => {
      const activity = await createActivity(actor, {
        type: "TASK",
        subject: args.subject,
        body: args.body ?? undefined,
        priority: args.priority,
        dueAt: addDays(new Date(), args.dueInDays).toISOString(),
        dealId: args.dealId,
        contactId: args.contactId,
      });
      return { resultId: activity.id, message: `Created task "${activity.subject}".` };
    },
  },
  {
    kind: "write",
    name: "update_deal_stage",
    description: "Propose moving a deal to a different pipeline stage. Needs the user's approval before it actually moves.",
    schema: updateDealStageArgs,
    summarize: async (args: z.infer<typeof updateDealStageArgs>, actor) => {
      const deal = await getDeal(actor, args.dealId);
      if (!deal) throw new CrmError(404, "Deal not found, or not visible to this user.");
      return `Move deal "${deal.title}" from ${deal.stage} to ${args.stage}.`;
    },
    apply: async (args: z.infer<typeof updateDealStageArgs>, actor) => {
      const deal = await updateDeal(actor, args.dealId, { stage: args.stage });
      return { resultId: deal.id, message: `Moved "${deal.title}" to ${args.stage}.` };
    },
  },
  {
    kind: "write",
    name: "draft_follow_up_email",
    description: "Propose sending a follow-up email to a contact. Nothing is sent until the user approves it.",
    schema: draftEmailArgs,
    summarize: async (args: z.infer<typeof draftEmailArgs>, actor) => {
      const contact = await getContact(actor, args.contactId);
      if (!contact) throw new CrmError(404, "Contact not found, or not visible to this user.");
      if (!contact.email) throw new CrmError(422, `${contact.firstName} ${contact.lastName} has no email address on file.`);
      return `Email ${contact.firstName} ${contact.lastName} <${contact.email}>: "${args.subject}".`;
    },
    apply: async (args: z.infer<typeof draftEmailArgs>, actor) => {
      const contact = await getContact(actor, args.contactId);
      if (!contact?.email) throw new CrmError(422, "This contact has no email address on file.");
      const result = await sendEmail({ to: contact.email, subject: args.subject, body: args.body, contactId: contact.id });
      return { message: `Email ${result.status === "SENT" ? "sent" : "logged"} to ${contact.email}.` };
    },
  },
];

function toAnthropicTool(def: ToolDef): Anthropic.Tool {
  const schema = z.toJSONSchema(def.schema) as Record<string, unknown>;
  delete schema.$schema;
  return { name: def.name, description: def.description, input_schema: schema as Anthropic.Tool.InputSchema };
}

// ---- the agent loop ----------------------------------------------------------

export type AgentProposalSummary = { id: string; tool: string; summary: string };
export type AgentTurnResult = { reply: string; proposals: AgentProposalSummary[] };

export async function runAgentCommand(actor: Actor, prompt: string): Promise<AgentTurnResult> {
  const anthropic = getClient();
  if (!anthropic) throw new CrmError(503, "The AI assistant is not configured (ANTHROPIC_API_KEY is not set).");
  const trimmed = prompt.trim();
  if (!trimmed) throw new CrmError(422, "Say something first.");

  return withAiLog(
    { feature: "agent_command", userId: actor.id, model: MODEL, metadata: { prompt: trimmed.slice(0, 500) } },
    async () => {
      const messages: Anthropic.MessageParam[] = [{ role: "user", content: trimmed }];
      const proposals: AgentProposalSummary[] = [];
      const usage = { inputTokens: 0, outputTokens: 0 };
      let finalText = "";

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools: TOOLS.map(toAnthropicTool),
          messages,
        });
        usage.inputTokens += response.usage?.input_tokens ?? 0;
        usage.outputTokens += response.usage?.output_tokens ?? 0;

        const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
        finalText = textBlocks.map((b) => b.text).join("\n").trim() || finalText;

        if (response.stop_reason === "refusal") {
          return { result: { reply: "I can't help with that request.", proposals: [] }, usage, refused: true };
        }

        const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (toolUses.length === 0) break; // model produced its final reply

        messages.push({ role: "assistant", content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const call of toolUses) {
          toolResults.push(await runTool(call, actor, proposals));
        }
        messages.push({ role: "user", content: toolResults });
      }

      return { result: { reply: finalText || "I couldn't come up with a response — try rephrasing.", proposals }, usage };
    },
  );
}

async function runTool(
  call: Anthropic.ToolUseBlock,
  actor: Actor,
  proposals: AgentProposalSummary[],
): Promise<Anthropic.ToolResultBlockParam> {
  const def = TOOLS.find((t) => t.name === call.name);
  if (!def) return { type: "tool_result", tool_use_id: call.id, content: `Unknown tool "${call.name}".`, is_error: true };

  const parsed = def.schema.safeParse(call.input);
  if (!parsed.success) {
    return { type: "tool_result", tool_use_id: call.id, content: `Invalid arguments: ${parsed.error.message}`, is_error: true };
  }

  try {
    if (def.kind === "read") {
      const data = await def.run(parsed.data as never, actor);
      return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(data).slice(0, 8000) };
    }
    const summary = await def.summarize(parsed.data as never, actor);
    const proposal = await prisma.agentProposal.create({
      data: { userId: actor.id, tool: def.name, args: parsed.data as Prisma.InputJsonValue, summary },
    });
    proposals.push({ id: proposal.id, tool: def.name, summary });
    return {
      type: "tool_result",
      tool_use_id: call.id,
      content: `Proposed to the user for approval: "${summary}". This has NOT happened yet — don't say it's done.`,
    };
  } catch (err) {
    const message = err instanceof CrmError ? err.message : "That didn't work — try a different approach.";
    return { type: "tool_result", tool_use_id: call.id, content: message, is_error: true };
  }
}

// ---- approving / rejecting a proposal ----------------------------------------

const applyByTool = new Map(TOOLS.filter((t): t is WriteTool => t.kind === "write").map((t) => [t.name, t]));

export async function resolveAgentProposal(actor: Actor, proposalId: string, approve: boolean): Promise<{ message: string }> {
  const proposal = await prisma.agentProposal.findUnique({ where: { id: proposalId } });
  if (!proposal || proposal.userId !== actor.id) throw new CrmError(404, "Proposal not found.");
  if (proposal.status !== "PENDING") throw new CrmError(409, "This proposal was already resolved.");
  if (Date.now() - proposal.createdAt.getTime() > PROPOSAL_TTL_MS) {
    await prisma.agentProposal.update({ where: { id: proposal.id }, data: { status: "EXPIRED", resolvedAt: new Date() } });
    throw new CrmError(410, "This proposal expired. Ask the assistant again.");
  }

  if (!approve) {
    await prisma.agentProposal.update({ where: { id: proposal.id }, data: { status: "REJECTED", resolvedAt: new Date() } });
    return { message: "Dismissed." };
  }

  const tool = applyByTool.get(proposal.tool);
  if (!tool) throw new CrmError(500, "Unknown proposal type.");
  const args = tool.schema.parse(proposal.args); // re-validated; the DB row isn't trusted as pre-validated input
  const { resultId, message } = await tool.apply(args as never, actor);
  await prisma.agentProposal.update({ where: { id: proposal.id }, data: { status: "APPROVED", resolvedAt: new Date(), resultId } });
  return { message };
}
