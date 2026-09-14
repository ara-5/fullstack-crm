"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Lightweight live updates: polls a version endpoint while the tab is visible and
 * refreshes the server-rendered page when someone else changes the data.
 * Works on serverless hosting where long-lived connections aren't available.
 */
export function LiveRefresh({ endpoint, version, intervalMs = 15_000 }: { endpoint: string; version: string; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version: string };
        if (!cancelled && data.version !== version) router.refresh();
      } catch {
        // offline: try again on the next tick
      }
    }
    const timer = setInterval(check, intervalMs);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [endpoint, version, intervalMs, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500" title="This board updates automatically">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Live
    </span>
  );
}
