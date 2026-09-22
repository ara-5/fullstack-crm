import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/crm";

const prismaMock = {
  agentProposal: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/crm", () => ({
  createActivity: vi.fn(),
  getContact: vi.fn(),
  getDeal: vi.fn(),
  listActivities: vi.fn(),
  listDeals: vi.fn(),
  searchRecords: vi.fn(),
  updateDeal: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/embeddings", () => ({ semanticSearch: vi.fn() }));
vi.mock("@/lib/ai-log", () => ({ withAiLog: vi.fn() }));

const { resolveAgentProposal } = await import("./agent");
const { updateDeal } = await import("./crm");

/**
 * These tests exercise resolveAgentProposal's state machine directly against
 * a mocked prisma.agentProposal — the same race conditions previously proven
 * with a throwaway script against real Postgres (double-approve, lost
 * reject/expire race), now pinned down as regression coverage. The AI/tool
 * call loop itself (runAgentCommand) isn't covered here — it needs a live or
 * mocked Anthropic client and is exercised end-to-end by the e2e suite.
 */

const actor: Actor = { id: "user-1", role: "REP" };

function makeProposal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "prop-1",
    userId: "user-1",
    tool: "update_deal_stage",
    args: { dealId: "deal-1", stage: "WON" },
    summary: "Move deal from LEAD to WON.",
    status: "PENDING",
    resultId: null,
    createdAt: new Date(),
    resolvedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveAgentProposal", () => {
  it("404s for a proposal that doesn't exist", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(null);
    await expect(resolveAgentProposal(actor, "nope", true)).rejects.toMatchObject({ status: 404 });
  });

  it("404s for another user's proposal (never reveals it exists)", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal({ userId: "someone-else" }));
    await expect(resolveAgentProposal(actor, "prop-1", true)).rejects.toMatchObject({ status: 404 });
  });

  it("409s a proposal that's already resolved", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal({ status: "APPROVED" }));
    await expect(resolveAgentProposal(actor, "prop-1", true)).rejects.toMatchObject({ status: 409 });
  });

  it("rejects a pending proposal without applying its tool", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal());
    prismaMock.agentProposal.updateMany.mockResolvedValue({ count: 1 });

    const result = await resolveAgentProposal(actor, "prop-1", false);

    expect(result.message).toBe("Dismissed.");
    expect(prismaMock.agentProposal.updateMany).toHaveBeenCalledWith({
      where: { id: "prop-1", status: "PENDING" },
      data: expect.objectContaining({ status: "REJECTED" }),
    });
    expect(updateDeal).not.toHaveBeenCalled();
  });

  it("410s and marks EXPIRED a stale proposal instead of applying it", async () => {
    const old = new Date(Date.now() - 31 * 60 * 1000); // TTL is 30 minutes
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal({ createdAt: old }));
    prismaMock.agentProposal.updateMany.mockResolvedValue({ count: 1 });

    await expect(resolveAgentProposal(actor, "prop-1", true)).rejects.toMatchObject({ status: 410 });

    expect(prismaMock.agentProposal.updateMany).toHaveBeenCalledWith({
      where: { id: "prop-1", status: "PENDING" },
      data: expect.objectContaining({ status: "EXPIRED" }),
    });
    expect(updateDeal).not.toHaveBeenCalled();
  });

  it("409s if a reject/expire loses the race to a concurrent resolve", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal());
    prismaMock.agentProposal.updateMany.mockResolvedValue({ count: 0 }); // someone else claimed it first
    await expect(resolveAgentProposal(actor, "prop-1", false)).rejects.toMatchObject({ status: 409 });
  });

  it("approves: claims the proposal, applies the tool, marks APPROVED with resultId", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal());
    prismaMock.agentProposal.updateMany.mockResolvedValue({ count: 1 }); // claim succeeds
    vi.mocked(updateDeal).mockResolvedValue({ id: "deal-1", title: "Acme renewal", stage: "WON" } as never);

    const result = await resolveAgentProposal(actor, "prop-1", true);

    expect(prismaMock.agentProposal.updateMany).toHaveBeenCalledWith({
      where: { id: "prop-1", status: "PENDING" },
      data: { status: "APPLYING" },
    });
    expect(updateDeal).toHaveBeenCalledWith(actor, "deal-1", { stage: "WON" });
    expect(result.message).toContain("WON");
    expect(prismaMock.agentProposal.update).toHaveBeenCalledWith({
      where: { id: "prop-1" },
      data: expect.objectContaining({ status: "APPROVED", resultId: "deal-1" }),
    });
  });

  it("409s an approve that loses the claim race (double-click / two open tabs) without double-applying", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal());
    prismaMock.agentProposal.updateMany.mockResolvedValue({ count: 0 }); // lost the claim

    await expect(resolveAgentProposal(actor, "prop-1", true)).rejects.toMatchObject({ status: 409 });
    expect(updateDeal).not.toHaveBeenCalled();
  });

  it("marks FAILED and rethrows when the tool's apply step throws", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal());
    prismaMock.agentProposal.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(updateDeal).mockRejectedValue(new Error("db exploded"));

    await expect(resolveAgentProposal(actor, "prop-1", true)).rejects.toThrow("db exploded");

    expect(prismaMock.agentProposal.update).toHaveBeenCalledWith({
      where: { id: "prop-1" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("500s for a proposal whose tool no longer exists (e.g. renamed since it was created)", async () => {
    prismaMock.agentProposal.findUnique.mockResolvedValue(makeProposal({ tool: "no_such_tool" }));
    await expect(resolveAgentProposal(actor, "prop-1", true)).rejects.toMatchObject({ status: 500 });
    expect(prismaMock.agentProposal.updateMany).not.toHaveBeenCalled();
  });
});
