import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside a React Server environment; unit tests import pure modules.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Unit tests never touch a real database (DB-backed modules are exercised
    // via mocked prisma), but importing them still runs src/lib/env.ts's
    // startup validation, which requires DATABASE_URL to be a non-empty
    // string. This placeholder — never dialed — keeps `npm test` runnable
    // without a local .env, matching what CI already sets at the job level.
    env: { DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused" },
  },
});
