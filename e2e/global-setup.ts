import { execSync } from "node:child_process";

// Every run starts from the same deterministic demo data.
export default function globalSetup() {
  execSync("npx prisma db seed", { stdio: "inherit" });
}
