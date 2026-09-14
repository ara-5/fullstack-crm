import { searchRecords } from "@/lib/crm";
import { getCurrentUser } from "@/lib/session";

// Powers the command palette. Session-authenticated; results respect record ownership.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ results: [] });
  return Response.json({ results: await searchRecords(user, q) });
}
