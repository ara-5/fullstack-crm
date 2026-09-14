"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/constants";
import { cx } from "@/lib/utils";

const NAV: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/companies", label: "Companies" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" },
  { href: "/reports", label: "Reports" },
  { href: "/automations", label: "Automations", roles: ["ADMIN", "MANAGER"] },
  { href: "/data", label: "Import / Export", roles: ["ADMIN", "MANAGER"] },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({
  user,
  logoutAction,
}: {
  user: { name: string; email: string; role: Role };
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const links = NAV.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cx(
          "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition",
          active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        )}
      >
        {item.label}
      </Link>
    );
  });

  const signOut = (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-slate-400 hover:text-white">
        Sign out
      </button>
    </form>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-900 md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">C</span>
          <span className="text-base font-semibold text-white">CRM</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">{links}</nav>
        <div className="border-t border-slate-800 px-5 py-4">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-slate-400">
            {user.email} · {user.role.toLowerCase()}
          </p>
          <div className="mt-3">{signOut}</div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 bg-slate-900 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-white">CRM</span>
          {signOut}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3">{links}</nav>
      </header>
    </>
  );
}
