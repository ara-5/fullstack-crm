// Continuously drains the Job outbox (webhook delivery, embeddings, ...).
// Run via `npx tsx scripts/worker.ts` — see the docker-compose `worker`
// service. On Vercel there's no long-running process to host this loop, so
// /api/cron/process-jobs does the same work per invocation instead.
import "../src/lib/job-handlers";
import { processJobs } from "../src/lib/jobs";

const POLL_MS = 5000;
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

async function loop() {
  console.log(`[worker] started, polling every ${POLL_MS}ms`);
  while (!stopping) {
    try {
      const processed = await processJobs(20);
      if (processed > 0) console.log(`[worker] processed ${processed} job(s)`);
    } catch (err) {
      console.error("[worker] error while processing jobs:", err);
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  console.log("[worker] stopped");
}

loop();
