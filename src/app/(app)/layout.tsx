import type { ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "@/lib/auth";
import { env } from "@/lib/env";
import { unreadCount } from "@/lib/notifications";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const initialUnread = await unreadCount(user.id);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar user={user} logoutAction={logout} sourceUrl={env.SOURCE_CODE_URL} initialUnread={initialUnread} />
      <main className="min-w-0 flex-1">
        {env.DEMO_MODE && (
          <p className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
            Public demo: data resets every night, and emails and webhooks are simulated.
          </p>
        )}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
      <CommandPalette role={user.role} />
    </div>
  );
}
