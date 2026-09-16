"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(app)/notifications/actions";
import { cx, timeAgo } from "@/lib/utils";

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const POLL_MS = 20_000;

export function NotificationBell({ initialUnread, className }: { initialUnread: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Notification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function refresh() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Notification[]; unreadCount: number };
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      // offline: keep showing the last known state
    }
  }

  useEffect(() => {
    // Deferred rather than called synchronously here, so the initial load
    // doesn't run during the effect's commit phase (see live-refresh.tsx).
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  async function openAndLoad() {
    setOpen((o) => !o);
    if (!items) await refresh();
  }

  async function onItemClick(n: Notification) {
    setOpen(false);
    if (!n.read) {
      setUnread((c) => Math.max(0, c - 1));
      await markNotificationReadAction(n.id);
      router.refresh();
    }
  }

  async function onMarkAllRead() {
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
    setUnread(0);
    await markAllNotificationsReadAction();
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={openAndLoad}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className={cx("relative rounded-md p-1.5 text-sm transition", className)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
          <path d="M10 2a5 5 0 00-5 5v2.379a2 2 0 01-.586 1.414L3 12.207V14h14v-1.793l-1.414-1.414A2 2 0 0115 9.379V7a5 5 0 00-5-5zM8.5 16a1.5 1.5 0 003 0h-3z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-slate-200 bg-surface py-1 text-slate-900 shadow-lg sm:right-auto"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead} className="text-xs font-medium text-indigo-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto border-t border-slate-100">
            {items === null ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
            ) : (
              <ul>
                {items.map((n) => {
                  const content = (
                    <>
                      <span className="flex items-start gap-2">
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" aria-hidden />}
                        <span className={cx("min-w-0 flex-1", n.read && "pl-3.5")}>
                          <span className="block text-sm text-slate-800">{n.title}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">{timeAgo(n.createdAt)}</span>
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={n.id} role="none">
                      {n.link ? (
                        <Link
                          href={n.link}
                          role="menuitem"
                          onClick={() => onItemClick(n)}
                          className="block px-3 py-2 hover:bg-slate-50"
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => onItemClick(n)}
                          className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
