"use client";

import { useEffect, useState } from "react";

type Viewer = { id: string; name: string };

const HEARTBEAT_MS = 10_000;

/** Shows who else is currently looking at this record, via a short client heartbeat. */
export function PresenceBar({ entityType, entityId }: { entityType: "contact" | "company" | "deal"; entityId: string }) {
  const [viewers, setViewers] = useState<Viewer[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function beat() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { viewers: Viewer[] };
        setViewers(data.viewers);
      } catch {
        // offline: just stop showing viewers until the next successful beat
      }
    }
    const initial = setTimeout(beat, 0);
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [entityType, entityId]);

  if (viewers.length === 0) return null;

  const names = viewers.map((v) => v.name);
  const label = names.length === 1 ? `${names[0]} is also viewing this` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are also viewing this`;

  return (
    <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
      </span>
      {label}
    </p>
  );
}
