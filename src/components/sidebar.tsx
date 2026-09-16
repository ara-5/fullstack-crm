"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme";
import type { Role } from "@/lib/constants";
import { navFor } from "@/lib/nav";
import { cx } from "@/lib/utils";

// The sidebar keeps fixed dark colors in both themes (hex values rather than
// slate tokens, which are remapped in dark mode).

function openCommandPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}

export function Sidebar({
  user,
  logoutAction,
  sourceUrl,
  initialUnread,
}: {
  user: { name: string; email: string; role: Role };
  logoutAction: () => Promise<void>;
  sourceUrl: string;
  initialUnread: number;
}) {
  const pathname = usePathname();
  const links = navFor(user.role).map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition",
          active ? "bg-[#1e293b] text-white" : "text-[#cbd5e1] hover:bg-[#1e293b]/60 hover:text-white",
        )}
      >
        {item.label}
      </Link>
    );
  });

  const signOut = (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-[#cbd5e1] hover:text-white">
        Sign out
      </button>
    </form>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#0f172a] md:flex dark:border-r dark:border-[#1e293b]">
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#6366f1] text-sm font-bold text-white">C</span>
            <span className="text-base font-semibold text-white">CRM</span>
          </span>
          <NotificationBell initialUnread={initialUnread} className="text-[#cbd5e1] hover:bg-[#1e293b] hover:text-white" />
        </div>
        <button
          type="button"
          onClick={openCommandPalette}
          className="mx-3 mb-3 flex items-center justify-between rounded-md bg-[#1e293b] px-3 py-2 text-sm text-[#cbd5e1] hover:text-white"
        >
          <span>Search…</span>
          <kbd className="rounded border border-[#475569] px-1.5 font-mono text-xs">Ctrl K</kbd>
        </button>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {links}
        </nav>
        <div className="border-t border-[#1e293b] px-5 py-4">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-[#cbd5e1]">
            {user.email} · {user.role.toLowerCase()}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            {signOut}
            <ThemeToggle className="text-[#cbd5e1] hover:text-white" />
          </div>
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block text-xs text-[#cbd5e1] hover:text-white">
            Source code (AGPL-3.0)
          </a>
        </div>
      </aside>

      <header className="sticky top-0 z-20 bg-[#0f172a] md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="font-semibold text-white">CRM</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={openCommandPalette} className="text-sm text-[#cbd5e1] hover:text-white">
              Search
            </button>
            <NotificationBell initialUnread={initialUnread} className="text-[#cbd5e1] hover:text-white" />
            <ThemeToggle className="text-[#cbd5e1] hover:text-white" />
            {signOut}
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3">
          {links}
        </nav>
      </header>
    </>
  );
}
