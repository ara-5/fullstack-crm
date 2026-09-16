"use server";

import { revalidatePath } from "next/cache";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  await markNotificationRead(user.id, id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidatePath("/", "layout");
}
