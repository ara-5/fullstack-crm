import Link from "next/link";
import type { SavedView } from "@prisma/client";
import { createSavedViewAction, deleteSavedViewAction } from "@/app/(app)/views/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import type { SavedViewEntity } from "@/lib/saved-views";

function toQuery(filters: unknown) {
  const sp = new URLSearchParams();
  if (filters && typeof filters === "object") {
    for (const [key, value] of Object.entries(filters as Record<string, unknown>)) {
      if (typeof value === "string" && value) sp.set(key, value);
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function SavedViews({
  entity,
  basePath,
  current,
  views,
}: {
  entity: SavedViewEntity;
  basePath: string;
  current: Record<string, string | undefined>;
  views: SavedView[];
}) {
  const cleanCurrent = Object.fromEntries(Object.entries(current).filter(([, v]) => v)) as Record<string, string>;
  const hasFilters = Object.keys(cleanCurrent).length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs">
      <span className="font-medium text-slate-500">Views:</span>
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-2.5">
          <Link href={`${basePath}${toQuery(v.filters)}`} className="text-slate-700 hover:text-indigo-700">
            {v.name}
          </Link>
          <form action={deleteSavedViewAction.bind(null, entity, v.id)}>
            <button type="submit" aria-label={`Delete view "${v.name}"`} className="rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              ×
            </button>
          </form>
        </span>
      ))}
      {hasFilters && (
        <ActionForm action={createSavedViewAction} resetOnSuccess className="flex items-center gap-1">
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="filters" value={JSON.stringify(cleanCurrent)} />
          <input
            type="text"
            name="name"
            placeholder="Save this view as…"
            required
            maxLength={60}
            className="rounded-full border-0 bg-slate-100 px-2.5 py-1 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <SubmitButton variant="secondary" className="rounded-full !bg-slate-100 !px-2.5 !py-1 !text-xs !text-slate-600 !ring-0 hover:!bg-slate-200" pendingText="…">
            Save
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
