import { listNotifications, unreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";

// Polled by the notification bell. Session-authenticated; a user only ever sees their own.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unread] = await Promise.all([listNotifications(user.id, 20), unreadCount(user.id)]);
  return Response.json({ notifications, unreadCount: unread }, { headers: { "Cache-Control": "no-store" } });
}
