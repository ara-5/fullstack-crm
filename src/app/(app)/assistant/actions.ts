"use server";

import { revalidatePath } from "next/cache";
import { resolveAgentProposal, runAgentCommand, type AgentTurnResult } from "@/lib/agent";
import { CrmError } from "@/lib/errors";
import { hit, retryAfterSeconds } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

const LIMIT = 30; // messages per user per hour — each one costs a real API call
const WINDOW_MS = 60 * 60 * 1000;

function toMessage(err: unknown) {
  if (err instanceof CrmError) return err.message;
  console.error(err);
  return "Something went wrong. Please try again.";
}

export async function sendAgentMessageAction(
  prompt: string,
): Promise<{ ok: true; data: AgentTurnResult } | { ok: false; error: string }> {
  const user = await requireUser();
  const limit = await hit(`agent:${user.id}`, LIMIT, WINDOW_MS);
  if (!limit.ok) {
    return { ok: false, error: `You've reached the assistant's limit. Try again in ${Math.ceil(retryAfterSeconds(limit.resetAt) / 60)} min.` };
  }
  try {
    return { ok: true, data: await runAgentCommand(user, prompt) };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export async function resolveAgentProposalAction(
  proposalId: string,
  approve: boolean,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const user = await requireUser();
  try {
    const result = await resolveAgentProposal(user, proposalId, approve);
    revalidatePath("/", "layout");
    return { ok: true, message: result.message };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}
