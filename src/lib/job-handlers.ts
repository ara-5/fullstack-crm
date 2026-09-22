import "server-only";

/**
 * Side-effect-only module: importing it registers every job handler. The
 * worker script and the /api/cron/process-jobs route both import this before
 * calling processJobs(), so job registration doesn't depend on which other
 * code paths happened to run first in a given process.
 */
import "@/lib/webhooks";
import "@/lib/embeddings";
