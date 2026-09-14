import { getDealsVersion } from "@/lib/health";
import { getCurrentUser } from "@/lib/session";

// Polled by the pipeline board (LiveRefresh) to detect changes made by teammates.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ version: await getDealsVersion(user) }, { headers: { "Cache-Control": "no-store" } });
}
