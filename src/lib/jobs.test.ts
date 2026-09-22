import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $queryRaw: vi.fn(),
  job: {
    create: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { enqueueJob, jobQueueSummary, processJobs, registerJobHandler, RetryableJobError } = await import("./jobs");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processJobs", () => {
  it("marks a job DONE when its handler succeeds", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerJobHandler("webhook_delivery", handler);
    prismaMock.$queryRaw.mockResolvedValue([{ id: "job-1", type: "webhook_delivery", payload: { a: 1 }, attempts: 0, maxAttempts: 5 }]);

    await expect(processJobs(10)).resolves.toBe(1);

    expect(handler).toHaveBeenCalledWith({ a: 1 }, { attempt: 1, maxAttempts: 5 });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "DONE", attempts: 1, lastError: null },
    });
  });

  it("retries with backoff when the handler throws a RetryableJobError and attempts remain", async () => {
    registerJobHandler("webhook_delivery", vi.fn().mockRejectedValue(new RetryableJobError("timeout")));
    prismaMock.$queryRaw.mockResolvedValue([{ id: "job-2", type: "webhook_delivery", payload: {}, attempts: 0, maxAttempts: 5 }]);

    await processJobs(10);

    expect(prismaMock.job.update).toHaveBeenCalledTimes(1);
    const call = prismaMock.job.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "job-2" });
    expect(call.data.status).toBe("PENDING");
    expect(call.data.attempts).toBe(1);
    expect(call.data.lastError).toBe("timeout");
    // first retry backs off ~5s (5000 * 4^(attempts-1))
    const delayMs = call.data.runAt.getTime() - Date.now();
    expect(delayMs).toBeGreaterThan(4000);
    expect(delayMs).toBeLessThan(6000);
  });

  it("fails permanently once attempts are exhausted, even for a retryable error", async () => {
    registerJobHandler("webhook_delivery", vi.fn().mockRejectedValue(new RetryableJobError("still failing")));
    prismaMock.$queryRaw.mockResolvedValue([{ id: "job-3", type: "webhook_delivery", payload: {}, attempts: 4, maxAttempts: 5 }]);

    await processJobs(10);

    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: "job-3" },
      data: { status: "FAILED", attempts: 5, lastError: "still failing" },
    });
  });

  it("fails immediately for a non-retryable error, without scheduling a retry", async () => {
    registerJobHandler("webhook_delivery", vi.fn().mockRejectedValue(new Error("bad payload")));
    prismaMock.$queryRaw.mockResolvedValue([{ id: "job-4", type: "webhook_delivery", payload: {}, attempts: 0, maxAttempts: 5 }]);

    await processJobs(10);

    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: "job-4" },
      data: { status: "FAILED", attempts: 1, lastError: "bad payload" },
    });
  });

  it("fails a job with no registered handler instead of throwing out of processJobs", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "job-5", type: "embed_record", payload: {}, attempts: 0, maxAttempts: 5 }]);

    await expect(processJobs(10)).resolves.toBe(1);

    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: "job-5" },
      data: { status: "FAILED", attempts: 1, lastError: 'No handler registered for job type "embed_record"' },
    });
  });

  it("is a no-op when nothing is due", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await expect(processJobs(10)).resolves.toBe(0);
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });
});

describe("enqueueJob", () => {
  it("defaults runAt to now and maxAttempts to 5", async () => {
    const before = Date.now();
    await enqueueJob("webhook_delivery", { hookId: "h1" });
    const [{ data }] = prismaMock.job.create.mock.calls[0];
    expect(data.type).toBe("webhook_delivery");
    expect(data.payload).toEqual({ hookId: "h1" });
    expect(data.maxAttempts).toBe(5);
    expect(data.runAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("honors an explicit runAt/maxAttempts", async () => {
    const runAt = new Date("2030-01-01T00:00:00Z");
    await enqueueJob("embed_record", { x: 1 }, { runAt, maxAttempts: 3 });
    expect(prismaMock.job.create).toHaveBeenCalledWith({
      data: { type: "embed_record", payload: { x: 1 }, runAt, maxAttempts: 3 },
    });
  });
});

describe("jobQueueSummary", () => {
  it("aggregates by type/status and lists recent failures", async () => {
    prismaMock.job.groupBy.mockResolvedValue([{ type: "webhook_delivery", status: "DONE", _count: { _all: 3 } }]);
    prismaMock.job.findMany.mockResolvedValue([{ id: "job-x", status: "FAILED" }]);

    const summary = await jobQueueSummary();

    expect(summary.byTypeStatus).toHaveLength(1);
    expect(summary.recentFailures).toHaveLength(1);
    expect(prismaMock.job.findMany).toHaveBeenCalledWith({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 10 });
  });
});
