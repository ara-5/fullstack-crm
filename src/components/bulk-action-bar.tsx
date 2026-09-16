"use client";

import type { ReactNode } from "react";

export function BulkActionBar({ count, onClear, pending, children }: { count: number; onClear: () => void; pending?: boolean; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-10 mx-3 my-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-surface px-4 py-3 shadow-lg">
      <span className="text-sm font-medium text-slate-700">
        {count} selected{pending && "…"}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <button type="button" onClick={onClear} className="ml-auto text-sm text-slate-500 hover:text-slate-700">
        Clear
      </button>
    </div>
  );
}
